import { 
   SRSGrade,
   StudyState,
   StudyProgress,
   SessionState,
   Card,
   ProgressStats,
   SessionQueues
} from './types';
import { createSession, getSession, updateSession, deleteSession } from './sessionManager';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../client';
import { updateProgress } from './progressTracker';
// TODO: Replace with real import from shared SRS logic
// If needed in the future: import { processGrade, isCardDue, ... } from '../../srs/srsAlgorithm';
// import { getNewCards, getLearningCards, getReviewCards, getDueCards } from '../../srs/cardScheduler';

/**
 * Maps a DB row from deck_words + words join to a Card and StudyProgress.
 */
function mapDbRowToCard(row: any): Card {
  const word = row.word || {};
  const progress: StudyProgress = {
    id: row.id, // deck_words.id
    vocabularyId: row.word_id, // deck_words.word_id
    userId: row.user_id, // deck_words.user_id
    state: row.state as StudyState,
    interval: row.interval,
    eFactor: row.e_factor,
    consecutiveCorrect: row.consecutive_correct,
    consecutiveIncorrect: row.consecutive_incorrect,
    totalReviews: row.total_reviews,
    nextReviewDate: new Date(row.next_review_date),
    lastReviewedDate: row.last_reviewed_date ? new Date(row.last_reviewed_date) : row.last_reviewed_date,
    firstSeenDate: row.first_seen_date ? new Date(row.first_seen_date) : row.first_seen_date,
    createdAt: new Date(row.created_at),
    updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
  };
  return {
    id: row.word_id,
    korean: word.word,
    english: word.definition,
    importanceScore: word.importanceScore || 0,
    studyProgress: progress,
  };
}

/**
 * Initializes session queues from a list of cards.
 */
function initializeQueues(cards: Card[]): SessionQueues {
  return {
    new: cards.filter(c => c.studyProgress.state === 'new'),
    learning: cards.filter(c => c.studyProgress.state === 'learning'),
    review: cards.filter(c => c.studyProgress.state === 'reviewing'),
    mistakes: [], // Will be filled during session
  };
}

/**
 * Selects the next card from the session queues (learning/mistakes > review > new).
 */
function selectNextCard(queues: SessionQueues): Card | null {
  return (
    queues.mistakes[0] ||
    queues.learning[0] ||
    queues.new[0] ||
    queues.review[0] ||
    null
  );
}

/**
 * Starts a new study session.
 * @param req { userId: string, deckId: string }
 * @returns { sessionId: string }
 */
export async function startSession(req: { userId: string; deckId: string }) {
  // Fetch cards from deck_words + words for this deck and user
  const { data: rows, error } = await supabase
    .from('deck_words')
    .select('*, word:words(*)')
    .eq('deck_id', req.deckId)
    .eq('user_id', req.userId);
  if (error) throw new Error('Failed to fetch cards for deck: ' + error.message);
  const cards: Card[] = (rows || []).map(mapDbRowToCard);
  const sessionId = uuidv4();
  const session: SessionState = {
    sessionId,
    userId: req.userId,
    deckId: req.deckId,
    cards, // store all cards
    progress: { reviewed: 0, grades: [] },
    currentCard: null,
    createdAt: new Date(),
    lastActive: new Date(),
  };
  createSession(session);
  return { sessionId };
}

/**
 * Gets the next due card for the session.
 * @param req { sessionId: string }
 * @returns { card: Card | null, progress: ProgressStats }
 */
export async function nextCard(req: { sessionId: string }) {
  const session = getSession(req.sessionId);
  if (!session) {
    throw new Error('Session not found or expired. Please start a new session.');
  }
  // Select next due card
  const now = new Date();
  const dueCards = session.cards.filter(card => card.studyProgress.nextReviewDate <= now);
  dueCards.sort((a, b) => a.studyProgress.nextReviewDate.getTime() - b.studyProgress.nextReviewDate.getTime());
  const next = dueCards[0] || null;
  session.currentCard = next;
  session.lastActive = new Date();
  updateSession(session);
  return { card: next, progress: session.progress };
}

/**
 * Grades the current card and updates session state and DB.
 * @param req { sessionId: string, cardId: string, grade: SRSGrade }
 * @returns { card: Card | null, progress: ProgressStats }
 */
export async function gradeCard(req: { sessionId: string; cardId: string; grade: SRSGrade }) {
  const session = getSession(req.sessionId);
  if (!session) {
    throw new Error('Session not found or expired. Please start a new session.');
  }
  if (!session.currentCard || session.currentCard.id !== req.cardId) {
    throw new Error('No current card found for this session.');
  }
  // Update StudyProgress using SRS logic
  const updatedProgress = updateProgress(session.currentCard.studyProgress, req.grade);
  session.currentCard.studyProgress = updatedProgress;
  // Persist progress to DB (deck_words)
  await supabase
    .from('deck_words')
    .update({
      state: updatedProgress.state,
      interval: updatedProgress.interval,
      e_factor: updatedProgress.eFactor,
      consecutive_correct: updatedProgress.consecutiveCorrect,
      consecutive_incorrect: updatedProgress.consecutiveIncorrect,
      total_reviews: updatedProgress.totalReviews,
      next_review_date: updatedProgress.nextReviewDate.toISOString(),
      last_reviewed_date: updatedProgress.lastReviewedDate?.toISOString() as string,
    })
    .eq('word_id', req.cardId)
    .eq('deck_id', session.deckId)
    .eq('user_id', session.userId);
  // Update the card in the session.cards array
  const idx = session.cards.findIndex((c: Card) => c.id === req.cardId);
  if (idx !== -1) {
    session.cards[idx].studyProgress = updatedProgress;
  }
  // Update session stats
  session.progress.reviewed += 1;
  session.progress.grades.push(req.grade);
  // Select next due card
  const now = new Date();
  const dueCards = session.cards.filter(card => card.studyProgress.nextReviewDate <= now);
  dueCards.sort((a, b) => a.studyProgress.nextReviewDate.getTime() - b.studyProgress.nextReviewDate.getTime());
  const next = dueCards[0] || null;
  session.currentCard = next;
  session.lastActive = new Date();
  updateSession(session);
  return { card: next, progress: session.progress };
}

/**
 * Quits the session and cleans up.
 * @param req { sessionId: string }
 * @returns { success: boolean }
 */
export async function quitSession(req: { sessionId: string }) {
  deleteSession(req.sessionId);
  return { success: true };
} 
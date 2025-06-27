import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env file in the project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// --- CONFIG ---
// You may want to load these from environment variables or a config file
const SUPABASE_URL = process.env.SUPABASE_URL ?? "https://dlfqyhxprxppgoanhtzd.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_KEY ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsZnF5aHhwcnhwcGdvYW5odHpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkwNjA3NzEsImV4cCI6MjA2NDYzNjc3MX0.17YhLWGbQQE9sKWVFm-LUKXwKbn4p8RxJBVQZD2V9WY";

const SERIES_NAME = 'Solo Leveling';
const CHAPTER_NUMBER = '1.1';
const MAX_LENGTH = 30;
const USER_ID = 'e7c42226-b66e-453f-8800-b882fd8900dd';

async function main() {
   console.log("SUPABASE_URL: ", SUPABASE_URL)
   console.log("SUPABASE_ANON_KEY: ", SUPABASE_ANON_KEY)
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Get the series id
  const { data: series, error: seriesError } = await supabase
    .from('series')
    .select('id')
    .eq('name', SERIES_NAME)
    .maybeSingle();
  if (seriesError || !series) {
    console.error('Series not found:', seriesError);
    return;
  }

  // Get the chapter id
  const { data: chapter, error: chapterError } = await supabase
    .from('chapters')
    .select('id')
    .eq('chapter_number', CHAPTER_NUMBER)
    .eq('series_id', series.id)
    .maybeSingle();
  if (chapterError || !chapter) {
    console.error('Chapter not found:', chapterError);
    return;
  }

  // Get all word_ids for this chapter
  const { data: chapterWords, error: wordsError } = await supabase
    .from('chapter_words')
    .select('word_id, importance_score')
    .eq('chapter_id', chapter.id);
  if (wordsError) {
    console.error('Error fetching chapter words:', wordsError);
    return;
  }
  console.log(`Found ${chapterWords.length} word_ids for series '${SERIES_NAME}' chapter '${CHAPTER_NUMBER}':`);
  let selectedWordIds = chapterWords?.map(w => w.word_id) || [];
  if (MAX_LENGTH && MAX_LENGTH > 0) {
   selectedWordIds = selectedWordIds.slice(0, MAX_LENGTH);
  }
  console.log(`Selected ${selectedWordIds.length} wordIds for deck creation.`);

  // --- Create a deck and insert deck_words rows for each selectedWordId ---
  // Create the deck
  /* const deckName = `${SERIES_NAME} Chapter ${CHAPTER_NUMBER} (debug)`;
  const { data: deck, error: deckError } = await supabase
    .from('decks')
    .insert({
      name: deckName,
      user_id: USER_ID, // Use a dummy user for debugging
      chapter_id: chapter.id
    })
    .select('*')
    .single();
  console.log('Inserted new deck into decks table.', deck ? 'Deck created.' : 'No deck created.');
  if (deckError || !deck) {
    console.error('Failed to create deck:', deckError?.message);
    return;
  }
  console.log('Created deck:', deck);

  // For each word, create a deck_words row with initial SRS state
  const now = new Date().toISOString();
  const initialSRS = {
    state: 'new',
    interval: 0,
    e_factor: 2.5,
    consecutive_correct: 0,
    consecutive_incorrect: 0,
    total_reviews: 0,
    next_review_date: now,
    last_reviewed_date: null,
    first_seen_date: null,
    created_at: now,
    updated_at: now,
  };
  let insertedCount = 0;
  for (const wordId of selectedWordIds) {
    const { error: insertError } = await supabase.from('deck_words').insert({
      deck_id: deck.id,
      word_id: wordId,
      user_id: USER_ID,
      ...initialSRS
    });
    if (!insertError) insertedCount++;
    //console.log(`Inserted deck_word for wordId ${wordId} into deck_words table.`);
    if (insertError) {
      console.error(`Failed to insert deck_word for wordId ${wordId}:`, insertError.message);
    }
  }
  console.log(`Inserted ${insertedCount} deck_words rows.`);

  // Fetch the cards for the deck (join deck_words + words)
  const { data: cards, error: cardsError } = await supabase
    .from('deck_words')
    .select('*, word:words(*)')
    .eq('deck_id', deck.id)
    .eq('user_id', USER_ID);
  console.log(`Queried deck_words table for cards joined with words. Found ${cards?.length || 0} cards.`);
  if (cardsError) {
    console.error('Failed to fetch deck cards:', cardsError.message);
    return;
  }
  console.log(`Inserted ${cards?.length || 0} deck_words. Example card:`, cards?.[0]); */
}

main().catch(err => {
  console.error('Unexpected error:', err);
});

/**
 * Database operations for vocabulary and chapter management.
 * Handles creating chapters, inserting vocabulary, and linking them.
 */

import { ankitoonSupabase, supabaseAdmin } from './client';
import type { Tables, TablesInsert } from './types/database.types';
import type { Word } from '../services/gemini-wrapper/geminiService';
import log from 'encore.dev/log';
import { APIError } from 'encore.dev/api';

type VocabularyRow = Tables<'vocabulary'>;
type ChapterVocabularyInsert = TablesInsert<'chapter_vocabulary'>;

export interface VocabularyWithId {
  id: string;
  term: string;
}

export interface InsertVocabularyResult {
  allVocabulary: VocabularyWithId[];
  newWordsInserted: number;
}

export interface ChapterStats {
  totalWordsInChapter: number;
  seriesSlug: string;
  chapterNumber: number;
}

/**
 * Looks up series_id from series_slug.
 * @param seriesSlug The slug identifier for the series.
 * @returns The series ID.
 */
export async function getSeriesIdBySlug(seriesSlug: string): Promise<string> {
  log.info('Looking up series by slug', { seriesSlug });

  const { data, error } = await ankitoonSupabase
    .from('series')
    .select('id')
    .eq('slug', seriesSlug)
    .single();

  if (error || !data) {
    log.error('Series not found', { seriesSlug, error: error?.message });
    throw APIError.notFound(`Series with slug '${seriesSlug}' not found`);
  }

  log.info('Found series', { seriesSlug, seriesId: data.id });
  return data.id;
}

/**
 * Creates a new chapter record.
 * @param seriesId The series ID.
 * @param chapterNumber The chapter number.
 * @param title Optional chapter title.
 * @returns The newly created chapter ID.
 */
export async function createChapter(
  seriesId: string,
  chapterNumber: number,
  title?: string
): Promise<string> {
  log.info('Creating chapter', { seriesId, chapterNumber, title });

  const { data, error } = await ankitoonSupabase
    .from('chapters')
    .insert({
      series_id: seriesId,
      chapter_number: chapterNumber,
      title: title || `Chapter ${chapterNumber}`
    })
    .select('id')
    .single();

  if (error || !data) {
    log.error('Failed to create chapter', { error: error?.message });
    throw APIError.internal('Failed to create chapter').withDetails({
      error: error?.message
    });
  }

  log.info('Created chapter', { chapterId: data.id });
  return data.id;
}

/**
 * Inserts vocabulary words, skipping existing terms.
 * Returns all vocabulary IDs (both existing and newly inserted).
 * @param words Array of Word objects from Gemini.
 * @returns Object with all vocabulary entries and count of new insertions.
 */
export async function insertNewVocabulary(
  words: Word[]
): Promise<InsertVocabularyResult> {
  const terms = words.map((w) => w.korean);
  log.info('Checking existing vocabulary', { termCount: terms.length });

  // 1. Check existing terms
  const { data: existingData, error: existingError } = await ankitoonSupabase
    .from('vocabulary')
    .select('id, term')
    .in('term', terms);

  if (existingError) {
    log.error('Failed to check existing vocabulary', {
      error: existingError.message
    });
    throw APIError.internal('Failed to check existing vocabulary');
  }

  const existing: VocabularyWithId[] = (existingData || []).map((v) => ({
    id: v.id,
    term: v.term
  }));
  const existingTerms = new Set(existing.map((v) => v.term));

  log.info('Found existing vocabulary', { existingCount: existing.length });

  // 2. Filter new words
  const newWords = words.filter((w) => !existingTerms.has(w.korean));
  log.info('New words to insert', { newWordCount: newWords.length });

  let inserted: VocabularyWithId[] = [];

  if (newWords.length > 0) {
    const insertData = newWords.map((w) => ({
      term: w.korean,
      definition: w.english
    }));

    const { data: insertedData, error: insertError } = await ankitoonSupabase
      .from('vocabulary')
      .insert(insertData)
      .select('id, term');

    if (insertError) {
      log.error('Failed to insert vocabulary', { error: insertError.message });
      throw APIError.internal('Failed to insert vocabulary');
    }

    inserted = (insertedData || []).map((v) => ({
      id: v.id,
      term: v.term
    }));
    log.info('Inserted new vocabulary', { insertedCount: inserted.length });
  }

  // 3. Combine existing and new
  const allVocabulary = [...existing, ...inserted];

  return {
    allVocabulary,
    newWordsInserted: inserted.length
  };
}

/**
 * Links vocabulary words to a chapter with importance scores.
 * @param chapterId The chapter ID.
 * @param vocabulary Array of vocabulary with IDs.
 * @param words Original words array with importance scores.
 */
export async function linkVocabularyToChapter(
  chapterId: string,
  vocabulary: VocabularyWithId[],
  words: Word[]
): Promise<void> {
  log.info('Linking vocabulary to chapter', {
    chapterId,
    vocabCount: vocabulary.length
  });

  // Create a map of term -> importanceScore
  const importanceMap = new Map<string, number>();
  for (const word of words) {
    importanceMap.set(word.korean, word.importanceScore);
  }

  // Build insert data
  const insertData: ChapterVocabularyInsert[] = vocabulary.map((v) => ({
    chapter_id: chapterId,
    vocabulary_id: v.id,
    importance_score: importanceMap.get(v.term) || 0
  }));

  const { error } = await ankitoonSupabase
    .from('chapter_vocabulary')
    .insert(insertData);

  if (error) {
    log.error('Failed to link vocabulary to chapter', { error: error.message });
    throw APIError.internal('Failed to link vocabulary to chapter');
  }

  log.info('Linked vocabulary to chapter successfully');
}

/**
 * Gets chapter statistics including word count and series info.
 * @param chapterId The chapter ID.
 * @returns Chapter stats with word count, series slug, and chapter number.
 */
export async function getChapterStats(chapterId: string): Promise<ChapterStats> {
  log.info('Getting chapter stats', { chapterId });

  // Get chapter info with series
  const { data: chapterData, error: chapterError } = await ankitoonSupabase
    .from('chapters')
    .select('chapter_number, series:series_id(slug)')
    .eq('id', chapterId)
    .single();

  if (chapterError || !chapterData) {
    log.error('Failed to get chapter info', { error: chapterError?.message });
    throw APIError.internal('Failed to get chapter info');
  }

  // Count words linked to chapter
  const { count, error: countError } = await ankitoonSupabase
    .from('chapter_vocabulary')
    .select('*', { count: 'exact', head: true })
    .eq('chapter_id', chapterId);

  if (countError) {
    log.error('Failed to count chapter vocabulary', {
      error: countError.message
    });
    throw APIError.internal('Failed to count chapter vocabulary');
  }

  // Handle the series relationship properly
  const series = chapterData.series as unknown as { slug: string };

  return {
    totalWordsInChapter: count || 0,
    seriesSlug: series?.slug || '',
    chapterNumber: chapterData.chapter_number
  };
}


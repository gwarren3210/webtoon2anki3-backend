/**
 * FSRS Progress Tracker
 * 
 * This file provides utility functions for working with FSRSProgress objects,
 * such as checking if a card is due for review and calculating days until the next review.
 */
import { FSRSProgress } from '../fsrs';

/**
 * Checks if a card is due for review.
 * @param progress - The FSRSProgress object to check.
 * @returns True if the card's due date is in the past or is today.
 */
export function isCardDue(progress: FSRSProgress): boolean {
  if (!progress) {
    return false; // Or handle as an error, depending on desired behavior
  }
  const now = new Date();
  // Set time to the beginning of the day for comparison
  now.setHours(0, 0, 0, 0); 
  return progress.due <= now;
}

/**
 * Calculates the number of days until the next review for a card.
 * @param progress - The FSRSProgress object to check.
 * @returns The number of days until the next review. A negative number indicates the card is overdue.
 */
export function daysUntilReview(progress: FSRSProgress): number {
  if (!progress) {
    throw new Error('FSRSProgress object cannot be null or undefined.');
  }
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(progress.due);
  due.setHours(0, 0, 0, 0);

  const timeDiff = due.getTime() - now.getTime();
  const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
  
  return daysDiff;
}

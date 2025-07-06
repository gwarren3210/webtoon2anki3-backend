/**
 * FSRS Module Index
 * 
 * This file exports all the necessary functions and types from the FSRS module,
 * providing a single entry point for other parts of the application to use
 * the FSRS logic.
 */

export { FSRSState, Rating as FSRSRating, defaultFSRSParameters } from './types';
export type { FSRSProgress, FSRSReviewLog, FSRSParameters } from './types';
export * from './algorithm'; 
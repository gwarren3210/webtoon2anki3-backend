/**
 * Study Session Management Tests
 * 
 * Comprehensive unit tests for study session management functionality
 */

import {
  createStudySession,
  endStudySession,
  pauseStudySession,
  resumeStudySession,
  updateSessionStats,
  calculateSessionStats,
  canContinueSession,
  getSessionSummary,
  StudySessionError
} from '../studySession';
import { StudySession, StudySessionConfig } from '../types';
import { describe, it, expect, beforeEach } from 'vitest';

describe('Study Session Management', () => {
  const mockUserId = 'user_123';
  const mockConfig: StudySessionConfig = {
    maxNewCards: 10,
    maxReviewCards: 20,
    includeNewCards: true,
    includeReviewCards: true,
    includeLearningCards: true,
    shuffleCards: true,
    showAnswerImmediately: false
  };

  describe('createStudySession', () => {
    it('should create a new study session with valid inputs', () => {
      const session = createStudySession(mockUserId, mockConfig);

      expect(session).toBeDefined();
      expect(session.id).toMatch(/^session_\d+_[a-z0-9]+$/);
      expect(session.userId).toBe(mockUserId);
      expect(session.startTime).toBeInstanceOf(Date);
      expect(session.cardsStudied).toBe(0);
      expect(session.correctAnswers).toBe(0);
      expect(session.incorrectAnswers).toBe(0);
      expect(session.sessionType).toBe('mixed');
      expect(session.isActive).toBe(true);
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.updatedAt).toBeInstanceOf(Date);
    });

    it('should determine correct session type for new cards only', () => {
      const newCardsConfig: StudySessionConfig = {
        ...mockConfig,
        includeNewCards: true,
        includeReviewCards: false,
        includeLearningCards: false
      };

      const session = createStudySession(mockUserId, newCardsConfig);
      expect(session.sessionType).toBe('new');
    });

    it('should determine correct session type for review cards only', () => {
      const reviewCardsConfig: StudySessionConfig = {
        ...mockConfig,
        includeNewCards: false,
        includeReviewCards: true,
        includeLearningCards: false
      };

      const session = createStudySession(mockUserId, reviewCardsConfig);
      expect(session.sessionType).toBe('review');
    });

    it('should throw error for missing user ID', () => {
      expect(() => createStudySession('', mockConfig)).toThrow(StudySessionError);
      expect(() => createStudySession('', mockConfig)).toThrow('User ID is required');
    });

    it('should throw error for missing configuration', () => {
      expect(() => createStudySession(mockUserId, null as any)).toThrow(StudySessionError);
      expect(() => createStudySession(mockUserId, null as any)).toThrow('Session configuration is required');
    });

    it('should throw error for invalid maxNewCards', () => {
      const invalidConfig = { ...mockConfig, maxNewCards: -1 };
      expect(() => createStudySession(mockUserId, invalidConfig)).toThrow(StudySessionError);
      expect(() => createStudySession(mockUserId, invalidConfig)).toThrow('Invalid maxNewCards');
    });

    it('should throw error for invalid maxReviewCards', () => {
      const invalidConfig = { ...mockConfig, maxReviewCards: -1 };
      expect(() => createStudySession(mockUserId, invalidConfig)).toThrow(StudySessionError);
      expect(() => createStudySession(mockUserId, invalidConfig)).toThrow('Invalid maxReviewCards');
    });

    it('should throw error for invalid maxSessionDuration', () => {
      const invalidConfig = { ...mockConfig, maxSessionDuration: 0 };
      expect(() => createStudySession(mockUserId, invalidConfig)).toThrow(StudySessionError);
      expect(() => createStudySession(mockUserId, invalidConfig)).toThrow('Invalid maxSessionDuration');
    });

    it('should throw error when no card types are included', () => {
      const invalidConfig: StudySessionConfig = {
        ...mockConfig,
        includeNewCards: false,
        includeReviewCards: false,
        includeLearningCards: false
      };
      expect(() => createStudySession(mockUserId, invalidConfig)).toThrow(StudySessionError);
      expect(() => createStudySession(mockUserId, invalidConfig)).toThrow('At least one card type must be included');
    });
  });

  describe('endStudySession', () => {
    let activeSession: StudySession;

    beforeEach(() => {
      activeSession = createStudySession(mockUserId, mockConfig);
    });

    it('should end an active session', () => {
      const endedSession = endStudySession(activeSession);

      expect(endedSession.endTime).toBeInstanceOf(Date);
      expect(endedSession.duration).toBeGreaterThanOrEqual(0);
      expect(endedSession.isActive).toBe(false);
      expect(endedSession.updatedAt).toBeInstanceOf(Date);
    });

    it('should calculate correct duration', () => {
      const endedSession = endStudySession(activeSession);
      expect(endedSession.duration).toBeGreaterThanOrEqual(0);
    });

    it('should throw error for inactive session', () => {
      const inactiveSession = { ...activeSession, isActive: false };
      expect(() => endStudySession(inactiveSession)).toThrow(StudySessionError);
      expect(() => endStudySession(inactiveSession)).toThrow('Cannot end an inactive session');
    });

    it('should throw error for session with existing end time', () => {
      const sessionWithEndTime = { ...activeSession, endTime: new Date() };
      expect(() => endStudySession(sessionWithEndTime)).toThrow(StudySessionError);
      expect(() => endStudySession(sessionWithEndTime)).toThrow('Session already has an end time');
    });
  });

  describe('pauseStudySession', () => {
    let activeSession: StudySession;

    beforeEach(() => {
      activeSession = createStudySession(mockUserId, mockConfig);
    });

    it('should pause an active session', () => {
      const pausedSession = pauseStudySession(activeSession);

      expect(pausedSession.isActive).toBe(false);
      expect(pausedSession.updatedAt).toBeInstanceOf(Date);
    });

    it('should throw error for inactive session', () => {
      const inactiveSession = { ...activeSession, isActive: false };
      expect(() => pauseStudySession(inactiveSession)).toThrow(StudySessionError);
      expect(() => pauseStudySession(inactiveSession)).toThrow('Cannot pause an inactive session');
    });
  });

  describe('resumeStudySession', () => {
    let pausedSession: StudySession;

    beforeEach(() => {
      const activeSession = createStudySession(mockUserId, mockConfig);
      pausedSession = pauseStudySession(activeSession);
    });

    it('should resume a paused session', () => {
      const resumedSession = resumeStudySession(pausedSession);

      expect(resumedSession.isActive).toBe(true);
      expect(resumedSession.updatedAt).toBeInstanceOf(Date);
    });

    it('should throw error for active session', () => {
      const activeSession = createStudySession(mockUserId, mockConfig);
      expect(() => resumeStudySession(activeSession)).toThrow(StudySessionError);
      expect(() => resumeStudySession(activeSession)).toThrow('Cannot resume an active session');
    });

    it('should throw error for ended session', () => {
      const endedSession = { ...pausedSession, endTime: new Date() };
      expect(() => resumeStudySession(endedSession)).toThrow(StudySessionError);
      expect(() => resumeStudySession(endedSession)).toThrow('Cannot resume an ended session');
    });
  });

  describe('updateSessionStats', () => {
    let activeSession: StudySession;

    beforeEach(() => {
      activeSession = createStudySession(mockUserId, mockConfig);
    });

    it('should update stats for correct answer', () => {
      const updatedSession = updateSessionStats(activeSession, true);

      expect(updatedSession.cardsStudied).toBe(1);
      expect(updatedSession.correctAnswers).toBe(1);
      expect(updatedSession.incorrectAnswers).toBe(0);
      expect(updatedSession.updatedAt).toBeInstanceOf(Date);
    });

    it('should update stats for incorrect answer', () => {
      const updatedSession = updateSessionStats(activeSession, false);

      expect(updatedSession.cardsStudied).toBe(1);
      expect(updatedSession.correctAnswers).toBe(0);
      expect(updatedSession.incorrectAnswers).toBe(1);
      expect(updatedSession.updatedAt).toBeInstanceOf(Date);
    });

    it('should accumulate stats correctly', () => {
      let session = activeSession;
      
      // Add several answers
      session = updateSessionStats(session, true);  // Correct
      session = updateSessionStats(session, false); // Incorrect
      session = updateSessionStats(session, true);  // Correct
      session = updateSessionStats(session, true);  // Correct

      expect(session.cardsStudied).toBe(4);
      expect(session.correctAnswers).toBe(3);
      expect(session.incorrectAnswers).toBe(1);
    });

    it('should throw error for inactive session', () => {
      const inactiveSession = { ...activeSession, isActive: false };
      expect(() => updateSessionStats(inactiveSession, true)).toThrow(StudySessionError);
      expect(() => updateSessionStats(inactiveSession, true)).toThrow('Cannot update stats for an inactive session');
    });
  });

  describe('calculateSessionStats', () => {
    it('should calculate correct accuracy for session with answers', () => {
      const session: StudySession = {
        id: 'test_session',
        userId: mockUserId,
        startTime: new Date('2024-01-01T10:00:00Z'),
        endTime: new Date('2024-01-01T10:05:00Z'),
        cardsStudied: 10,
        correctAnswers: 7,
        incorrectAnswers: 3,
        sessionType: 'mixed',
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const stats = calculateSessionStats(session);

      expect(stats.accuracy).toBe(70);
      expect(stats.sessionDuration).toBe(300); // 5 minutes in seconds
    });

    it('should calculate zero accuracy for session with no cards studied', () => {
      const session: StudySession = {
        id: 'test_session',
        userId: mockUserId,
        startTime: new Date('2024-01-01T10:00:00Z'),
        endTime: new Date('2024-01-01T10:05:00Z'),
        cardsStudied: 0,
        correctAnswers: 0,
        incorrectAnswers: 0,
        sessionType: 'mixed',
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const stats = calculateSessionStats(session);

      expect(stats.accuracy).toBe(0);
      expect(stats.sessionDuration).toBe(300);
    });

    it('should calculate duration for active session', () => {
      const startTime = new Date('2024-01-01T10:00:00Z');
      const session: StudySession = {
        id: 'test_session',
        userId: mockUserId,
        startTime,
        cardsStudied: 5,
        correctAnswers: 4,
        incorrectAnswers: 1,
        sessionType: 'mixed',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const stats = calculateSessionStats(session);
      const expectedDuration = Math.floor((new Date().getTime() - startTime.getTime()) / 1000);

      expect(stats.accuracy).toBe(80);
      expect(stats.sessionDuration).toBeGreaterThanOrEqual(expectedDuration - 1);
      expect(stats.sessionDuration).toBeLessThanOrEqual(expectedDuration + 1);
    });
  });

  describe('canContinueSession', () => {
    let activeSession: StudySession;

    beforeEach(() => {
      activeSession = createStudySession(mockUserId, mockConfig);
    });

    it('should return true for valid active session', () => {
      expect(canContinueSession(activeSession, mockConfig)).toBe(true);
    });

    it('should return false for inactive session', () => {
      const inactiveSession = { ...activeSession, isActive: false };
      expect(canContinueSession(inactiveSession, mockConfig)).toBe(false);
    });

    it('should return false for ended session', () => {
      const endedSession = { ...activeSession, endTime: new Date() };
      expect(canContinueSession(endedSession, mockConfig)).toBe(false);
    });

    it('should return false when session duration limit is exceeded', () => {
      const oldStartTime = new Date(Date.now() - (61 * 60 * 1000)); // 61 minutes ago
      const oldSession = { ...activeSession, startTime: oldStartTime };
      const configWithDuration = { ...mockConfig, maxSessionDuration: 60 };

      expect(canContinueSession(oldSession, configWithDuration)).toBe(false);
    });

    it('should return false when new card limit is reached', () => {
      const sessionAtLimit = { ...activeSession, cardsStudied: 10 };
      const configWithNewLimit = { ...mockConfig, maxNewCards: 10 };

      expect(canContinueSession(sessionAtLimit, configWithNewLimit)).toBe(false);
    });

    it('should return false when review card limit is reached', () => {
      const sessionAtLimit = { ...activeSession, cardsStudied: 20 };
      const configWithReviewLimit = { ...mockConfig, maxReviewCards: 20 };

      expect(canContinueSession(sessionAtLimit, configWithReviewLimit)).toBe(false);
    });
  });

  describe('getSessionSummary', () => {
    it('should return formatted session summary', () => {
      const session: StudySession = {
        id: 'test_session',
        userId: mockUserId,
        startTime: new Date('2024-01-01T10:00:00Z'),
        endTime: new Date('2024-01-01T10:02:30Z'), // 2 minutes 30 seconds
        cardsStudied: 15,
        correctAnswers: 12,
        incorrectAnswers: 3,
        sessionType: 'mixed',
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const summary = getSessionSummary(session);

      expect(summary.duration).toBe('2:30');
      expect(summary.accuracy).toBe('80%');
      expect(summary.cardsStudied).toBe(15);
      expect(summary.correctAnswers).toBe(12);
      expect(summary.incorrectAnswers).toBe(3);
    });

    it('should handle zero duration correctly', () => {
      const session: StudySession = {
        id: 'test_session',
        userId: mockUserId,
        startTime: new Date('2024-01-01T10:00:00Z'),
        endTime: new Date('2024-01-01T10:00:00Z'),
        cardsStudied: 0,
        correctAnswers: 0,
        incorrectAnswers: 0,
        sessionType: 'mixed',
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const summary = getSessionSummary(session);

      expect(summary.duration).toBe('0:00');
      expect(summary.accuracy).toBe('0%');
    });

    it('should handle single digit seconds correctly', () => {
      const session: StudySession = {
        id: 'test_session',
        userId: mockUserId,
        startTime: new Date('2024-01-01T10:00:00Z'),
        endTime: new Date('2024-01-01T10:00:05Z'), // 5 seconds
        cardsStudied: 1,
        correctAnswers: 1,
        incorrectAnswers: 0,
        sessionType: 'mixed',
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const summary = getSessionSummary(session);

      expect(summary.duration).toBe('0:05');
      expect(summary.accuracy).toBe('100%');
    });
  });

  describe('Error handling', () => {
    it('should validate session data structure', () => {
      const invalidSession = {
        id: '',
        userId: '',
        startTime: null,
        cardsStudied: -1,
        correctAnswers: -1,
        incorrectAnswers: -1
      } as any;

      expect(() => calculateSessionStats(invalidSession)).toThrow(StudySessionError);
    });

    it('should validate answer count consistency', () => {
      const invalidSession: StudySession = {
        id: 'test_session',
        userId: mockUserId,
        startTime: new Date(),
        cardsStudied: 5,
        correctAnswers: 3,
        incorrectAnswers: 3, // 3 + 3 = 6 > 5
        sessionType: 'mixed',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(() => calculateSessionStats(invalidSession)).toThrow(StudySessionError);
      expect(() => calculateSessionStats(invalidSession)).toThrow('Sum of correct and incorrect answers cannot exceed total cards studied');
    });

    it('should validate time range consistency', () => {
      const invalidSession: StudySession = {
        id: 'test_session',
        userId: mockUserId,
        startTime: new Date('2024-01-01T10:00:00Z'),
        endTime: new Date('2024-01-01T09:00:00Z'), // End before start
        cardsStudied: 5,
        correctAnswers: 3,
        incorrectAnswers: 2,
        sessionType: 'mixed',
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(() => calculateSessionStats(invalidSession)).toThrow(StudySessionError);
      expect(() => calculateSessionStats(invalidSession)).toThrow('End time cannot be before start time');
    });
  });
}); 
var SCHEMA = {
  Tables: {
    Projects: {
      id: 'string',
      status: 'string',
      created_at: 'string',
      updated_at: 'string'
    },
    Answers: {
      id: 'string',
      projectId: 'string',
      questionId: 'string',
      value: 'any',
      created_at: 'string',
      updated_at: 'string'
    },
    Requirements: {
      id: 'string',
      projectId: 'string',
      category: 'string',
      text: 'string',
      source: 'string',
      confidence: 'string'
    }
  }
};

var APP = {
  NAME: 'ProjectScope',
  VERSION: '1.0.0',
  CACHE_EXPIRATION: 21600,
  MAX_TEXT: 2000,
  MAX_SHORT_TEXT: 200
};

/** Stored in place of an answer when the client taps "Not sure yet". Shared with index.html via getProjectState. */
var NOT_SURE = '__not_sure__';

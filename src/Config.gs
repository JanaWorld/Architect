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
  CACHE_EXPIRATION: 21600
};

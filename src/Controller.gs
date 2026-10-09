function getProjectState(projectId) {
  var now = new Date().toISOString();
  var project;

  if (!projectId) {
    project = { id: Util.generateId(), status: 'DISCOVERY', created_at: now, updated_at: now };
    Db.insert('Projects', project);
  } else {
    project = Db.query('Projects', function(p) { return p.id === projectId; })[0];
    if (!project) throw new Error('Project not found');
  }

  var answers = Db.query('Answers', function(a) { return a.projectId === project.id; });
  var answeredIds = answers.map(function(a) { return a.questionId; });

  var facts = FactsEngine.processAnswers(answers);
  var nextQuestions = QuestionEngine.getNextQuestions(facts, answeredIds, 3);
  var requirements = RequirementEngine.extractRequirements(facts);
  var architecture = ArchitectureEngine.evaluate(requirements, facts);

  Db.flush();

  return {
    project: project,
    facts: facts,
    answers: answers,
    nextQuestions: nextQuestions.map(function(q) { return QuestionBank.toClient(q, false); }),
    requirements: requirements,
    architecture: architecture,
    notSure: NOT_SURE
  };
}

function submitAnswer(projectId, questionId, value) {
  if (!projectId) throw new Error('Missing project id');

  var project = Db.query('Projects', function(p) { return p.id === projectId; })[0];
  if (!project) throw new Error('Project not found');

  var question = QuestionBank.get(questionId);
  if (!question) throw new Error('Unknown question: ' + questionId);

  var problem = QuestionBank.validateAnswer(question, value);
  if (problem) throw new Error(problem);

  var now = new Date().toISOString();
  var existing = Db.query('Answers', function(a) {
    return a.projectId === projectId && a.questionId === questionId;
  })[0];

  if (existing) {
    existing.value = value;
    existing.updated_at = now;
    Db.update('Answers', existing);
  } else {
    Db.insert('Answers', {
      id: Util.generateId(),
      projectId: projectId,
      questionId: questionId,
      value: value,
      created_at: now,
      updated_at: now
    });
  }

  project.updated_at = now;
  Db.update('Projects', project);

  Db.flush();
  return getProjectState(projectId);
}

function doGet(e) {
  return HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setTitle('ProjectScope - Technical Discovery')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

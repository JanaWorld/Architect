function getProjectState(projectId) {
  var project;
  if (!projectId) {
    project = {
        id: Util.generateId(),
        status: 'DISCOVERY',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };
    Db.insert('Projects', project);
  } else {
    project = Db.query('Projects', function(p) { return p.id === projectId; })[0];
    if (!project) throw new Error("Project not found");
  }
  
  var answers = Db.query('Answers', function(a) { return a.projectId === project.id; });
  var answeredQuestionIds = answers.map(function(a) { return a.questionId; });
  
  var facts = FactsEngine.processAnswers(answers);
  var nextQuestions = QuestionEngine.getNextQuestions(facts, answeredQuestionIds, 3);
  
  var requirements = RequirementEngine.extractRequirements(facts);
  var architecture = ArchitectureEngine.evaluate(requirements, facts);
  
  Db.flush(); 
  
  return {
      project: project,
      facts: facts,
      answers: answers,
      nextQuestions: nextQuestions,
      requirements: requirements,
      architecture: architecture
  };
}

function submitAnswer(projectId, questionId, value) {
    var answer = {
        id: Util.generateId(),
        projectId: projectId,
        questionId: questionId,
        value: value,
        created_at: new Date().toISOString()
    };
    
    var existing = Db.query('Answers', function(a) { return a.projectId === projectId && a.questionId === questionId; })[0];
    if (existing) {
        existing.value = value;
        existing.updated_at = new Date().toISOString();
        Db.update('Answers', existing);
    } else {
        Db.insert('Answers', answer);
    }
    
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

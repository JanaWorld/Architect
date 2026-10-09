var QuestionEngine = {
  getNextQuestions: function(facts, answeredQuestionIds, limit) {
    limit = limit || 3;
    var candidates = [];
    
    QuestionBank.all().forEach(function(q) {
      if (answeredQuestionIds.includes(q.id)) return;
      
      if (q.when && typeof q.when === 'function') {
        if (!q.when(facts)) return;
      }
      
      var score = 0;
      if (q.priority === 'P0') score += 1000;
      if (q.priority === 'P1') score += 500;
      if (q.priority === 'P2') score += 200;
      if (q.priority === 'P3') score += 100;
      
      if (q.need && typeof q.need === 'function') {
        score += q.need(facts);
      }
      
      score -= candidates.length; 
      
      candidates.push({ question: q, score: score });
    });
    
    candidates.sort(function(a, b) { return b.score - a.score; });
    
    return candidates.slice(0, limit).map(function(c) { return c.question; });
  }
};

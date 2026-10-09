var FactsEngine = {
  processAnswers: function(answers) {
    var facts = {};
    
    answers.forEach(function(answer) {
      var q = QuestionBank.get(answer.questionId);
      if (!q) return;
      
      var qFacts = FactsEngine.resolveAnswerToFacts(q, answer);
      Object.assign(facts, qFacts);
    });
    
    this.inferFacts(facts);
    return facts;
  },
  
  resolveAnswerToFacts: function(question, answer) {
    var newFacts = {};
    var val = answer.value;
    
    newFacts[question.id] = { source: 'answer', confidence: 'HIGH', value: val, questionId: question.id };
    
    if (question.resolves) {
       for (var factKey in question.resolves) {
         var resolver = question.resolves[factKey];
         if (typeof resolver === 'function') {
           var res = resolver(val);
           if (res !== undefined) {
             newFacts[factKey] = { source: 'inferred', confidence: 'HIGH', value: res, questionId: question.id };
           }
         } else if (typeof resolver === 'object') {
             if (resolver[val] !== undefined) {
               newFacts[factKey] = { source: 'inferred', confidence: 'HIGH', value: resolver[val], questionId: question.id };
             }
         }
       }
    }
    return newFacts;
  },
  
  inferFacts: function(facts) {
    if (facts.users_login && facts.users_login.value === 'yes') {
      facts.needs_auth = { source: 'rule', confidence: 'HIGH', value: true };
    }
    
    if ((facts.payments && facts.payments.value !== 'no') || 
        (facts.sell_products && facts.sell_products.value === 'yes')) {
      facts.is_ecommerce = { source: 'rule', confidence: 'MEDIUM', value: true };
    }
    
    if (facts.live_updates && facts.live_updates.value === 'yes') {
        facts.needs_realtime = { source: 'rule', confidence: 'HIGH', value: true };
    }
  }
};

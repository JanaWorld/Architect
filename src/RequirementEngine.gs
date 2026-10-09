var RequirementEngine = {
  extractRequirements: function(facts) {
    var requirements = [];
    RequirementEngine.processBusinessRequirements(facts, requirements);
    RequirementEngine.processFunctionalRequirements(facts, requirements);
    RequirementEngine.processNonFunctionalRequirements(facts, requirements);
    return requirements;
  },

  addReq: function(reqs, category, text, confidence, sourceFact) {
    reqs.push({
      id: Util.generateId(),
      category: category,
      text: text,
      confidence: confidence,
      sourceFact: sourceFact
    });
  },

  processBusinessRequirements: function(facts, reqs) {
    var F = FactsEngine;
    var label = QuestionBank.labelFor;

    if (F.has(facts, 'text.description')) {
      RequirementEngine.addReq(reqs, 'Business', 'Core Goal: ' + F.value(facts, 'text.description'), 'HIGH', 'text.description');
    }
    if (F.has(facts, 'outcome')) {
      RequirementEngine.addReq(reqs, 'Business', 'Primary outcome: ' + label('outcome', F.value(facts, 'outcome')), 'HIGH', 'outcome');
    }
    if (F.has(facts, 'budget')) {
      RequirementEngine.addReq(reqs, 'Budget', 'Budget Constraint: ' + label('budget', F.value(facts, 'budget')), 'HIGH', 'budget');
    }
    if (F.has(facts, 'timeline')) {
      RequirementEngine.addReq(reqs, 'Timeline', 'Target Deadline: ' + label('timeline', F.value(facts, 'timeline')), 'HIGH', 'timeline');
    }
  },

  processFunctionalRequirements: function(facts, reqs) {
    var F = FactsEngine;
    var label = QuestionBank.labelFor;

    if (F.isTruthy(F.value(facts, 'rule.auth'))) {
      RequirementEngine.addReq(reqs, 'Functional', 'User Authentication System', 'HIGH', 'rule.auth');
      if (F.has(facts, 'roles')) {
        RequirementEngine.addReq(reqs, 'Functional', 'Access roles: ' + label('roles', F.value(facts, 'roles')), 'HIGH', 'roles');
      }
    }

    if (F.isTruthy(F.value(facts, 'rule.ecommerce'))) {
      RequirementEngine.addReq(reqs, 'Functional', 'E-commerce and Product Management', 'HIGH', 'rule.ecommerce');
    }

    if (F.isTruthy(F.value(facts, 'cap.payments'))) {
      var payText = 'Payment Processing Integration';
      if (F.has(facts, 'pay.types')) payText += ' (' + label('pay.types', F.value(facts, 'pay.types')) + ')';
      RequirementEngine.addReq(reqs, 'Functional', payText, 'HIGH', 'cap.payments');
    }
    if (F.isTruthy(F.value(facts, 'pay.methods'))) {
      RequirementEngine.addReq(reqs, 'Functional', 'Accepted payment methods: ' + label('pay.methods', F.value(facts, 'pay.methods')), 'HIGH', 'pay.methods');
    }

    if (F.isTruthy(F.value(facts, 'integrations.list'))) {
      RequirementEngine.addReq(reqs, 'Integration', 'Integrations: ' + label('integrations.list', F.value(facts, 'integrations.list')), 'HIGH', 'integrations.list');
    }
  },

  processNonFunctionalRequirements: function(facts, reqs) {
    var F = FactsEngine;
    var label = QuestionBank.labelFor;

    if (F.isTruthy(F.value(facts, 'rule.realtime'))) {
      RequirementEngine.addReq(reqs, 'Performance', 'Low-latency real-time data updates', 'HIGH', 'rule.realtime');
    }

    if (F.has(facts, 'scale.users')) {
      var tierText = {
        standard: 'Standard',
        high: 'High availability & scalable',
        very_high: 'High availability & horizontally scalable'
      }[F.value(facts, 'rule.traffic_tier')] || 'Standard';
      RequirementEngine.addReq(reqs, 'Scalability',
        'Expected users in year one: ' + label('scale.users', F.value(facts, 'scale.users')) + ' (' + tierText + ')',
        'HIGH', 'scale.users');
    }

    if (F.isTruthy(F.value(facts, 'cap.sensitiveData'))) {
      RequirementEngine.addReq(reqs, 'Security', 'Strict data security and compliance', 'HIGH', 'cap.sensitiveData');
    }
    if (F.isTruthy(F.value(facts, 'data.types'))) {
      RequirementEngine.addReq(reqs, 'Security', 'Data to store: ' + label('data.types', F.value(facts, 'data.types')), 'HIGH', 'data.types');
    }
    if (F.isTruthy(F.value(facts, 'compliance'))) {
      RequirementEngine.addReq(reqs, 'Security', 'Compliance obligations: ' + label('compliance', F.value(facts, 'compliance')), 'HIGH', 'compliance');
    }
  }
};

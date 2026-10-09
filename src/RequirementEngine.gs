var RequirementEngine = {
  extractRequirements: function(facts) {
    var requirements = [];
    
    this.processBusinessRequirements(facts, requirements);
    this.processFunctionalRequirements(facts, requirements);
    this.processNonFunctionalRequirements(facts, requirements);
    
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
    if (facts.project_goal) {
      this.addReq(reqs, 'Business', "Core Goal: " + facts.project_goal.value, 'HIGH', 'project_goal');
    }
    if (facts.budget_range) {
      this.addReq(reqs, 'Budget', "Budget Constraint: " + facts.budget_range.value, 'HIGH', 'budget_range');
    }
    if (facts.timeline) {
      this.addReq(reqs, 'Timeline', "Target Deadline: " + facts.timeline.value, 'HIGH', 'timeline');
    }
  },

  processFunctionalRequirements: function(facts, reqs) {
    if (facts.needs_auth && facts.needs_auth.value) {
      this.addReq(reqs, 'Functional', 'User Authentication System', 'HIGH', 'needs_auth');
    }
    if (facts.is_ecommerce && facts.is_ecommerce.value) {
      this.addReq(reqs, 'Functional', 'E-commerce and Product Management', 'HIGH', 'is_ecommerce');
    }
    if (facts.payments && facts.payments.value !== 'no' && facts.payments.value !== 'none') {
        this.addReq(reqs, 'Functional', "Payment Processing Integration (" + facts.payments.value + ")", 'HIGH', 'payments');
    }
  },

  processNonFunctionalRequirements: function(facts, reqs) {
      if (facts.needs_realtime && facts.needs_realtime.value) {
          this.addReq(reqs, 'Performance', 'Low-latency real-time data updates', 'HIGH', 'needs_realtime');
      }
      if (facts.traffic_volume) {
          var scale = 'Standard';
          if (facts.traffic_volume.value === 'high' || facts.traffic_volume.value === 'very_high') scale = 'High Availability & Scalable';
          this.addReq(reqs, 'Scalability', "Architecture must support " + facts.traffic_volume.value + " traffic (" + scale + ")", 'HIGH', 'traffic_volume');
      }
      if (facts.data_sensitivity && facts.data_sensitivity.value !== 'public') {
          this.addReq(reqs, 'Security', "Strict data security and compliance (Sensitivity: " + facts.data_sensitivity.value + ")", 'HIGH', 'data_sensitivity');
      }
  }
};

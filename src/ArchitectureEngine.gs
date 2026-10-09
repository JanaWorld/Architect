var ArchitectureEngine = {
  evaluate: function(requirements, facts) {
    var patterns = this.evaluatePatterns(requirements, facts);
    var techStack = this.evaluateTechStack(requirements, facts, patterns[0]);
    
    return {
        patterns: patterns,
        recommendedTechStack: techStack,
        reasoning: "Based on the functional and non-functional requirements extracted from the client's answers."
    };
  },
  
  evaluatePatterns: function(reqs, facts) {
      var scores = {
          'Static Website / JAMStack': 0,
          'Server-Rendered Monolith': 0,
          'Single Page Application (SPA) + API': 0,
          'Microservices Architecture': 0,
          'Serverless Architecture': 0
      };
      
      if (facts.content_heavy && facts.content_heavy.value === 'yes') {
          scores['Static Website / JAMStack'] += 50;
      }
      
      if (facts.needs_realtime && facts.needs_realtime.value) {
          scores['Single Page Application (SPA) + API'] += 30;
          scores['Server-Rendered Monolith'] -= 20;
      }
      
      if (facts.traffic_volume && facts.traffic_volume.value === 'very_high') {
          scores['Serverless Architecture'] += 40;
          scores['Microservices Architecture'] += 30;
      }
      
      if (facts.is_ecommerce && facts.is_ecommerce.value) {
           scores['Server-Rendered Monolith'] += 20;
           scores['Single Page Application (SPA) + API'] += 20;
      }
      
      if (facts.budget_range && (facts.budget_range.value === 'very_low' || facts.budget_range.value === 'low')) {
          scores['Microservices Architecture'] -= 100;
          scores['Server-Rendered Monolith'] += 50;
      }
      
      var sorted = Object.keys(scores).map(function(k) { return { pattern: k, score: scores[k] }; }).sort(function(a,b) { return b.score - a.score; });
      return sorted;
  },
  
  evaluateTechStack: function(reqs, facts, topPattern) {
      var stack = {
          frontend: [],
          backend: [],
          database: [],
          infrastructure: []
      };
      
      if (topPattern.pattern === 'Static Website / JAMStack') {
          stack.frontend.push({ name: 'Next.js (Static Export)', confidence: 'HIGH' });
          stack.frontend.push({ name: 'Astro', confidence: 'MEDIUM' });
          stack.database.push({ name: 'Headless CMS (Sanity/Contentful)', confidence: 'HIGH' });
      } else if (topPattern.pattern === 'Single Page Application (SPA) + API') {
          stack.frontend.push({ name: 'React', confidence: 'HIGH' });
          stack.frontend.push({ name: 'Vue.js', confidence: 'MEDIUM' });
          stack.backend.push({ name: 'Node.js / Express', confidence: 'HIGH' });
          stack.database.push({ name: 'PostgreSQL', confidence: 'HIGH' });
      } else {
          stack.frontend.push({ name: 'React (Next.js)', confidence: 'HIGH' });
          stack.backend.push({ name: 'Node.js or Python', confidence: 'MEDIUM' });
          stack.database.push({ name: 'PostgreSQL', confidence: 'HIGH' });
      }
      
      if (facts.needs_realtime && facts.needs_realtime.value) {
          stack.infrastructure.push({ name: 'WebSockets / Socket.io', confidence: 'HIGH' });
          stack.database.push({ name: 'Redis (Caching/PubSub)', confidence: 'MEDIUM' });
      }
      
      return stack;
  }
};

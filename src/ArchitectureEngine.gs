var ArchitectureEngine = {
  evaluate: function(requirements, facts) {
    var patterns = ArchitectureEngine.evaluatePatterns(requirements, facts);
    var techStack = ArchitectureEngine.evaluateTechStack(requirements, facts, patterns[0]);

    return {
      patterns: patterns,
      recommendedTechStack: techStack,
      reasoning: 'Based on the functional and non-functional requirements extracted from the client\'s answers.'
    };
  },

  evaluatePatterns: function(reqs, facts) {
    var F = FactsEngine;
    var scores = {
      'Static Website / JAMStack': 0,
      'Server-Rendered Monolith': 0,
      'Single Page Application (SPA) + API': 0,
      'Microservices Architecture': 0,
      'Serverless Architecture': 0
    };

    if (F.value(facts, 'rule.content_heavy') === true) {
      scores['Static Website / JAMStack'] += 50;
    }

    if (F.isTruthy(F.value(facts, 'rule.realtime'))) {
      scores['Single Page Application (SPA) + API'] += 30;
      scores['Server-Rendered Monolith'] -= 20;
    }

    if (F.value(facts, 'rule.traffic_tier') === 'very_high') {
      scores['Serverless Architecture'] += 40;
      scores['Microservices Architecture'] += 30;
    }

    if (F.isTruthy(F.value(facts, 'rule.ecommerce'))) {
      scores['Server-Rendered Monolith'] += 20;
      scores['Single Page Application (SPA) + API'] += 20;
    }

    var budget = F.value(facts, 'rule.budget_tier');
    if (budget === 'low') {
      scores['Microservices Architecture'] -= 100;
      scores['Server-Rendered Monolith'] += 50;
    }

    return Object.keys(scores)
      .map(function(k) { return { pattern: k, score: scores[k] }; })
      .sort(function(a, b) { return b.score - a.score; });
  },

  evaluateTechStack: function(reqs, facts, topPattern) {
    var stack = { frontend: [], backend: [], database: [], infrastructure: [] };

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

    if (FactsEngine.isTruthy(FactsEngine.value(facts, 'rule.realtime'))) {
      stack.infrastructure.push({ name: 'WebSockets / Socket.io', confidence: 'HIGH' });
      stack.database.push({ name: 'Redis (Caching/PubSub)', confidence: 'MEDIUM' });
    }

    return stack;
  }
};

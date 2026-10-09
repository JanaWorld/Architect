/**
 * Chooses the next questions to ask.
 * Score = priority bonus + importance x necessity. Necessity starts at the question's base
 * and rises when the business type or a confirmed capability makes the question more relevant.
 * Conditions (`conditions`, the `when` DSL) decide whether a question is eligible at all.
 */
var QuestionEngine = {
  getNextQuestions: function(facts, answeredQuestionIds, limit) {
    limit = limit || 3;
    var candidates = [];

    QuestionBank.all().forEach(function(q, index) {
      if (answeredQuestionIds.indexOf(q.id) !== -1) return;
      if (q.conditions && !Conditions.evaluate(q.conditions, facts)) return;

      var priorityBonus = q.priority === 'P0' ? 10 : 0;
      var score = priorityBonus + q.importance * QuestionEngine.necessity(q, facts) - index * 0.001;
      candidates.push({ question: q, score: score });
    });

    candidates.sort(function(a, b) { return b.score - a.score; });
    return candidates.slice(0, limit).map(function(c) { return c.question; });
  },

  necessity: function(q, facts) {
    var need = q.need || {};
    var score = typeof need.base === 'number' ? need.base : 0.6;

    var types = FactsEngine.typesOf(facts);
    Object.keys(need.types || {}).forEach(function(t) {
      if (types.indexOf(t) !== -1) score = Math.max(score, need.types[t]);
    });

    Object.keys(need.caps || {}).forEach(function(c) {
      if (FactsEngine.isTruthy(FactsEngine.value(facts, 'cap.' + c))) {
        score = Math.max(score, need.caps[c]);
      }
    });

    return score;
  }
};

/** Evaluates the condition DSL used in QuestionBank (`when`). */
var Conditions = {
  evaluate: function(c, facts) {
    if (c === null || c === undefined) return true;
    if (c.all) return c.all.every(function(x) { return Conditions.evaluate(x, facts); });
    if (c.any) return c.any.some(function(x) { return Conditions.evaluate(x, facts); });
    if (c.not) return !Conditions.evaluate(c.not, facts);
    if (c.fact !== undefined) return Conditions.factAtom_(c, facts);
    if (c.type !== undefined) {
      var types = FactsEngine.typesOf(facts);
      return [].concat(c.type).some(function(t) { return types.indexOf(t) !== -1; });
    }
    return false;
  },

  factAtom_: function(c, facts) {
    var entry = facts[c.fact];
    if (!entry) return false;
    if (c.strong && entry.confidence !== 'HIGH') return false;

    var v = entry.value;
    if (c.truthy !== undefined) return FactsEngine.isTruthy(v) === !!c.truthy;
    if (c.includesAny) {
      var list = Array.isArray(v) ? v : [v];
      return c.includesAny.some(function(x) { return list.indexOf(x) !== -1; });
    }
    if (c.in) return c.in.indexOf(v) !== -1;
    return false;
  }
};

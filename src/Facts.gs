/**
 * FactsEngine: turns the client's answers into named facts.
 *
 * Each fact is { value, confidence, source } stored under a key:
 *   - answer keys come from each question's `resolves` list (e.g. 'budget', 'cap.payments')
 *   - 'cap.*'            capabilities. HIGH when the client confirmed them (feature or answer),
 *                        MEDIUM when inferred from business type.
 *   - 'rule.*'           conclusions used by the requirement and architecture engines
 *   - 'classification'   business types detected from the answers (keyword heuristic, MEDIUM)
 */

var FEATURE_CAPS = {
  blog: 'blog', forms: 'forms', accounts: 'accounts', bookings: 'bookings',
  payments: 'payments', catalog: 'catalog', search: 'search', uploads: 'uploads',
  messaging: 'messaging', notifications: 'notifications', dashboards: 'dashboards',
  maps: 'maps', workflows: 'workflows', reviews: 'reviews', multilang: 'multilang',
  smart: 'ai'
};

var TYPE_FROM_OUTCOME = {
  presence: 'corporate', sell: 'ecommerce', bookings: 'booking', operations: 'internal_tool',
  connect: 'community', learn: 'learning', insight: 'dashboard', automate: 'automation'
};

var TYPE_FROM_FEATURE_CAP = {
  bookings: 'booking', catalog: 'ecommerce', dashboards: 'dashboard', blog: 'blog'
};

var TYPE_KEYWORDS = [
  ['healthcare', /\b(healthcare|health (care|services?)|clinics?|doctors?|patients?|hospitals?|medical|pharmac\w*|dentists?)\b/],
  ['finance', /\b(banks?|banking|loans?|lending|insurance|accounting|invoices?|fintech|finance)\b/],
  ['government', /\b(government|municipal\w*|ministry|public sector|citizens?|govt)\b/],
  ['learning', /\b(courses?|schools?|students?|tutor\w*|colleges?|classes|teach\w*|learning|training)\b/],
  ['restaurant', /\b(restaurants?|cafes?|menus?|dine|dining)\b/],
  ['event', /\b(events?|conferences?|symposiums?|festivals?|tickets?|hackathons?)\b/],
  ['marketplace', /\b(marketplaces?|vendors?|sellers?)\b/],
  ['logistics', /\b(deliver(y|ies)|logistics|couriers?|fleets?|shipping)\b/],
  ['real_estate', /\b(property|properties|real estate|rentals?|apartments?)\b/],
  ['portfolio', /\b(portfolio|resumes?|personal (site|website))\b/],
  ['blog', /\b(blogs?|news|articles?)\b/],
  ['erp', /\b(erp|inventory|warehouses?)\b/],
  ['crm', /\b(crm|sales pipeline|leads)\b/],
  ['community', /\b(community|forums?|members)\b/]
];

var CAP_FROM_TYPE = {
  ecommerce: 'commerce', restaurant: 'ordering', event: 'events', learning: 'education',
  community: 'community', marketplace: 'marketplace', booking: 'bookings',
  saas: 'subscriptions', real_estate: 'listings'
};

var BUDGET_TIER = { b0: 'low', b1: 'low', b2: 'medium', b3: 'high', b4: 'high' };
var TRAFFIC_TIER = { large: 'high', huge: 'very_high' };

var FactsEngine = {
  NEGATIVE: ['no', 'none', 'none_known', 'undecided'],

  value: function(facts, name) {
    var entry = facts[name];
    return entry ? entry.value : undefined;
  },

  /** True when the client gave a real answer (not missing, not "Not sure yet"). */
  has: function(facts, name) {
    var v = FactsEngine.value(facts, name);
    return v !== undefined && v !== null && v !== NOT_SURE;
  },

  isStrong: function(facts, name) {
    var entry = facts[name];
    return !!entry && entry.confidence === 'HIGH';
  },

  /** Whether a value means "yes / present". Handles yes/no, option lists and multi-select arrays. */
  isTruthy: function(v) {
    if (v === true) return true;
    if (v === false || v === undefined || v === null) return false;
    if (Array.isArray(v)) return v.some(function(x) { return FactsEngine.isTruthy(x); });
    if (typeof v === 'string') {
      var s = v.trim();
      return s !== '' && s !== NOT_SURE && FactsEngine.NEGATIVE.indexOf(s) === -1;
    }
    return !!v;
  },

  typesOf: function(facts) {
    var c = facts.classification;
    return c && Array.isArray(c.value) ? c.value : [];
  },

  processAnswers: function(answers) {
    var facts = {};

    // Features first, so a later explicit answer to a capability question can override them.
    answers.forEach(function(a) {
      if (a.questionId === 'q_features') FactsEngine.applyFeatures_(a.value, facts);
    });

    answers.forEach(function(a) {
      var q = QuestionBank.get(a.questionId);
      if (q) Object.assign(facts, FactsEngine.resolveAnswerToFacts(q, a));
    });

    FactsEngine.classify_(facts);
    FactsEngine.capsFromTypes_(facts);
    FactsEngine.applyRules_(facts);
    return facts;
  },

  resolveAnswerToFacts: function(question, answer) {
    var out = {};
    var confidence = answer.value === NOT_SURE ? 'LOW' : 'HIGH';
    (question.resolves || []).forEach(function(key) {
      out[key] = { value: answer.value, confidence: confidence, source: 'answer', questionId: question.id };
    });
    return out;
  },

  applyFeatures_: function(features, facts) {
    (Array.isArray(features) ? features : []).forEach(function(f) {
      if (Object.prototype.hasOwnProperty.call(FEATURE_CAPS, f)) {
        facts['cap.' + FEATURE_CAPS[f]] = { value: true, confidence: 'HIGH', source: 'feature' };
      }
    });
  },

  textOf_: function(facts) {
    return ['text.description', 'text.problem'].map(function(k) {
      var v = FactsEngine.value(facts, k);
      return typeof v === 'string' && v !== NOT_SURE ? v : '';
    }).join(' ');
  },

  /** Heuristic business-type detection from the outcome, confirmed features and free-text answers. */
  classify_: function(facts) {
    var found = {};
    var add = function(t) { if (t) found[t] = true; };
    var lookup = function(map, key) {
      return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : null;
    };

    add(lookup(TYPE_FROM_OUTCOME, FactsEngine.value(facts, 'outcome')));

    Object.keys(TYPE_FROM_FEATURE_CAP).forEach(function(cap) {
      if (FactsEngine.isTruthy(FactsEngine.value(facts, 'cap.' + cap))) add(TYPE_FROM_FEATURE_CAP[cap]);
    });

    var text = FactsEngine.textOf_(facts).toLowerCase();
    TYPE_KEYWORDS.forEach(function(rule) {
      if (rule[1].test(text)) add(rule[0]);
    });

    var types = Object.keys(found);
    facts.classification = {
      value: types.length ? types : ['general'],
      confidence: 'MEDIUM',
      source: 'rule'
    };
  },

  /** Business types imply capabilities, at MEDIUM confidence (a guess the client has not confirmed). */
  capsFromTypes_: function(facts) {
    FactsEngine.typesOf(facts).forEach(function(t) {
      if (!Object.prototype.hasOwnProperty.call(CAP_FROM_TYPE, t)) return;
      var key = 'cap.' + CAP_FROM_TYPE[t];
      if (!facts[key]) facts[key] = { value: true, confidence: 'MEDIUM', source: 'rule' };
    });
  },

  applyRules_: function(facts) {
    var F = FactsEngine;
    var on = function(name) { return F.isTruthy(F.value(facts, name)); };
    var put = function(key, value, confidence) {
      facts[key] = { value: value, confidence: confidence, source: 'rule' };
    };
    var types = F.typesOf(facts);
    var hasType = function(list) {
      return list.some(function(t) { return types.indexOf(t) !== -1; });
    };

    if (on('cap.accounts')) {
      put('rule.auth', true, F.isStrong(facts, 'cap.accounts') ? 'HIGH' : 'MEDIUM');
    }

    if (on('cap.payments') || on('cap.commerce') || hasType(['ecommerce', 'marketplace'])) {
      var confirmed = on('cap.payments') || F.isStrong(facts, 'cap.commerce');
      put('rule.ecommerce', true, confirmed ? 'HIGH' : 'MEDIUM');
    }

    var realtime = F.value(facts, 'cap.realtime');
    if (realtime === 'some' || realtime === 'core') {
      put('rule.realtime', true, 'HIGH');
    }

    if (hasType(['corporate', 'portfolio', 'blog', 'learning']) &&
        !on('rule.ecommerce') && !on('rule.realtime') && !on('rule.auth')) {
      put('rule.content_heavy', true, 'MEDIUM');
    }

    var budget = F.value(facts, 'budget');
    if (Object.prototype.hasOwnProperty.call(BUDGET_TIER, budget)) {
      put('rule.budget_tier', BUDGET_TIER[budget], 'HIGH');
    }

    var scale = F.value(facts, 'scale.users');
    if (F.has(facts, 'scale.users')) {
      put('rule.traffic_tier', Object.prototype.hasOwnProperty.call(TRAFFIC_TIER, scale) ? TRAFFIC_TIER[scale] : 'standard', 'HIGH');
    }
  }
};

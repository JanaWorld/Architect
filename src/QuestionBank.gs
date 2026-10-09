/**
 * QuestionBank — catalogue of client-answerable discovery questions.
 *
 * Rules applied when writing questions (Product rule #1):
 *  - Ask only what the client can answer (business/domain knowledge), never technology choices.
 *  - Every question declares which facts it `resolves` and its `technicalImpacts`, so the engine
 *    can compute Question Value = Impact × Uncertainty × Necessity and skip low-value questions.
 *
 * Fields:
 *  id, category, text, description, helpText, type, options, required, priority (P0–P3), importance,
 *  audience ('client'|'developer'), stage ('core'|'followup'), conditions (`when` DSL), necessity
 *  (`need`: base + per-project-type + per-capability boosts), followUpQuestions, technicalImpacts,
 *  requirementTags, resolves, validation, allowNotSure, allowOther, clientVisible, developerVisible.
 *
 * Condition DSL (`when`):
 *   { all:[...], any:[...], not:{...} }
 *   atoms: { fact:'cap.payments', truthy:true, strong:true }   strong = confirmed or inferred HIGH
 *          { fact:'users', includesAny:['public','customers'] }
 *          { fact:'scale.users', in:['medium','large','huge'] }
 *          { type:['healthcare','finance'] }                     primary/secondary/domain classification
 */
var QuestionBank = (function () {
  var IMPACT = { P0: 1.0, P1: 0.8, P2: 0.55, P3: 0.35 };

  function opts_(list) {
    return (list || []).map(function (o) { return { value: o[0], label: o[1], hint: o[2] || '' }; });
  }

  function Q_(d) {
    var q = {
      id: d.id,
      category: d.category || 'General',
      text: d.text,
      description: d.description || '',
      helpText: d.helpText || '',
      type: d.type || 'single',
      options: opts_(d.options),
      required: d.required !== undefined ? d.required : d.priority === 'P0',
      priority: d.priority || 'P2',
      importance: d.importance !== undefined ? d.importance : IMPACT[d.priority || 'P2'],
      audience: d.audience || 'client',
      stage: d.stage || 'followup',
      order: d.order || 0,
      conditions: d.when || null,
      need: d.need || { base: 0.6 },
      followUpQuestions: d.followUps || [],
      technicalImpacts: d.impacts || [],
      requirementTags: d.tags || [],
      resolves: d.resolves || [],
      validation: d.validation || null,
      allowNotSure: d.notSure !== undefined ? d.notSure : true,
      allowOther: !!d.other,
      clientVisible: d.clientVisible !== undefined ? d.clientVisible : true,
      developerVisible: true,
      placeholder: d.placeholder || ''
    };
    return q;
  }

  var QUESTIONS = [
    // ───────────────────────── CORE DISCOVERY (P0) ─────────────────────────
    Q_({ id: 'q_build', stage: 'core', order: 1, priority: 'P0', category: 'Vision', type: 'long', notSure: false,
      text: 'In a few sentences, what would you like to build?',
      helpText: 'Describe it the way you would explain it to a friend. No technical words needed.',
      placeholder: 'e.g. A website where patients can book appointments with our doctors and get reminders.',
      resolves: ['text.description'], impacts: ['classification', 'scope'], tags: ['business'],
      validation: { minLength: 10, maxLength: APP.MAX_TEXT } }),
    Q_({ id: 'q_problem', stage: 'core', order: 2, priority: 'P0', category: 'Vision', type: 'long', notSure: true,
      text: 'What problem should it solve, or what is not working well today?',
      helpText: 'Think about what is slow, manual, costly or frustrating right now.',
      placeholder: 'e.g. Our receptionist spends hours on the phone and patients often miss appointments.',
      resolves: ['text.problem'], impacts: ['scope', 'requirements'], tags: ['business'],
      validation: { maxLength: APP.MAX_TEXT } }),
    Q_({ id: 'q_users', stage: 'core', order: 3, priority: 'P0', category: 'People', type: 'multi', other: true,
      text: 'Who will use it?', helpText: 'Choose everyone who will interact with it.',
      options: [
        ['public', 'Members of the public / website visitors'],
        ['customers', 'Your customers or clients'],
        ['members', 'Registered members or subscribers'],
        ['staff', 'Your staff or team'],
        ['partners', 'Partners, suppliers, vendors or sellers'],
        ['businesses', 'Other businesses (B2B)'],
        ['admins', 'Only a few administrators']
      ],
      resolves: ['users'], impacts: ['authentication', 'authorization', 'roles', 'seo'], tags: ['user'] }),
    Q_({ id: 'q_outcome', stage: 'core', order: 4, priority: 'P0', category: 'Vision', type: 'single', other: true,
      text: 'What is the single most important outcome for you?',
      options: [
        ['presence', 'Be found online and build trust'],
        ['sell', 'Sell products or services online'],
        ['bookings', 'Take bookings, appointments or registrations'],
        ['operations', 'Run internal work more efficiently'],
        ['connect', 'Connect people or build a community'],
        ['learn', 'Teach, train or share knowledge'],
        ['insight', 'Track data and make better decisions'],
        ['automate', 'Automate a manual or repetitive task']
      ],
      resolves: ['outcome'], impacts: ['classification', 'architecture', 'scope'], tags: ['business'] }),
    Q_({ id: 'q_platforms', stage: 'core', order: 5, priority: 'P0', category: 'Platforms', type: 'multi',
      text: 'Where should people be able to use it?',
      options: [
        ['web_desktop', 'Web browser on a computer'],
        ['web_mobile', 'Web browser on a phone'],
        ['ios', 'iPhone app (App Store)'],
        ['android', 'Android app (Play Store)'],
        ['desktop_app', 'Installed desktop software'],
        ['kiosk', 'Shared tablets or kiosks']
      ],
      resolves: ['platforms'], impacts: ['frontend', 'mobile', 'cost', 'timeline'], tags: ['platform'] }),
    Q_({ id: 'q_existing', stage: 'core', order: 6, priority: 'P0', category: 'Current situation', type: 'single',
      text: 'Is there an existing website, app, spreadsheet or tool involved?',
      options: [
        ['none', 'No, we are starting fresh'],
        ['replace', 'Yes, this replaces something we use today'],
        ['connect', 'Yes, it needs to work with tools we already use'],
        ['both', 'Both: replace some tools and connect to others']
      ],
      followUps: ['q_existing_detail', 'q_migration', 'q_integrations'],
      resolves: ['existing'], impacts: ['integration', 'migration', 'risk'], tags: ['integration'] }),
    Q_({ id: 'q_timeline', stage: 'core', order: 7, priority: 'P0', category: 'Timeline', type: 'single',
      text: 'When do you need the first version to be live?',
      options: [
        ['lt1', 'Within 1 month'], ['m1_3', '1 to 3 months'], ['m3_6', '3 to 6 months'],
        ['m6_12', '6 to 12 months'], ['flexible', 'Flexible / no fixed date']
      ],
      resolves: ['timeline'], impacts: ['scope', 'estimate', 'risk'], tags: ['timeline'] }),
    Q_({ id: 'q_budget', stage: 'core', order: 8, priority: 'P0', category: 'Budget', type: 'single',
      text: 'What budget range have you planned for the first version?',
      helpText: 'A rough range is fine. It helps recommend what fits; it is not a target to spend.',
      options: [
        ['b0', 'Under $2,000 (about ₹1.7 lakh)'],
        ['b1', '$2,000 to $8,000 (about ₹1.7 to 7 lakh)'],
        ['b2', '$8,000 to $25,000 (about ₹7 to 21 lakh)'],
        ['b3', '$25,000 to $75,000 (about ₹21 to 63 lakh)'],
        ['b4', 'More than $75,000'],
        ['undecided', 'Not decided yet']
      ],
      resolves: ['budget'], impacts: ['architecture', 'technology', 'scope', 'risk'], tags: ['budget'] }),

    // ───────────────────────── FEATURES (asked first after core) ─────────────────────────
    Q_({ id: 'q_features', priority: 'P1', importance: 1, category: 'Features', type: 'multi', other: true,
      text: 'Which of these must the first version do?',
      helpText: 'Pick only what is essential for launch. Everything else can come later.',
      options: [
        ['pages', 'Show information pages about you or your services'],
        ['blog', 'Publish articles, news or updates'],
        ['forms', 'Contact, enquiry or application forms'],
        ['accounts', 'Let people create accounts and sign in'],
        ['bookings', 'Bookings, appointments or registrations'],
        ['payments', 'Take online payments'],
        ['catalog', 'Show a catalogue of products, items or listings'],
        ['search', 'Search and filter'],
        ['uploads', 'Upload files, photos or documents'],
        ['messaging', 'Messaging or chat between people'],
        ['notifications', 'Send email, SMS or WhatsApp updates'],
        ['dashboards', 'Reports, charts or dashboards'],
        ['maps', 'Maps, locations or tracking'],
        ['workflows', 'Approvals or multi-step workflows'],
        ['reviews', 'Ratings and reviews'],
        ['multilang', 'Multiple languages'],
        ['smart', 'Smart/automated features (e.g. AI answers, summaries, recommendations)']
      ],
      need: { base: 1 },
      resolves: ['features'], impacts: ['scope', 'architecture', 'technology', 'estimate'], tags: ['functional'] }),

    // ───────────────────────── PEOPLE & ACCESS ─────────────────────────
    Q_({ id: 'q_accounts', priority: 'P1', category: 'People', type: 'single',
      text: 'Will people need to sign in?',
      options: [
        ['everyone', 'Yes, most users will have an account'],
        ['some', 'Only some people (e.g. staff or admins)'],
        ['none', 'No, everything is public']
      ],
      need: { base: 0.75, types: { portfolio: 0.25, corporate: 0.35, blog: 0.35 }, caps: { bookings: 0.9, payments: 0.8, community: 1, education: 0.9 } },
      resolves: ['cap.accounts'], impacts: ['authentication', 'security', 'database'], tags: ['security', 'user'] }),
    Q_({ id: 'q_roles', priority: 'P1', category: 'People', type: 'multi', other: true,
      text: 'Which groups of people need different access or see different things?',
      options: [
        ['customer', 'Customers / end users'],
        ['provider', 'Service providers (e.g. doctors, tutors, agents)'],
        ['seller', 'Sellers or vendors'],
        ['staff', 'Staff / operators'],
        ['manager', 'Managers / supervisors'],
        ['admin', 'Administrators'],
        ['guest', 'Guests without an account']
      ],
      when: { all: [{ fact: 'cap.accounts', truthy: true, strong: true }] },
      need: { base: 0.9 },
      resolves: ['roles'], impacts: ['authorization', 'security', 'estimate'], tags: ['user', 'security'] }),
    Q_({ id: 'q_admin', priority: 'P2', category: 'People', type: 'multi',
      text: 'What should administrators be able to do?',
      options: [
        ['manage_users', 'Manage users'], ['manage_content', 'Manage content and listings'],
        ['approve', 'Approve or reject items'], ['reports', 'See reports'],
        ['export', 'Export data'], ['settings', 'Change settings and prices']
      ],
      when: { all: [{ fact: 'cap.accounts', truthy: true, strong: true }] },
      need: { base: 0.55, types: { internal_tool: 0.8, marketplace: 0.9, saas: 0.8 } },
      resolves: ['admin.needs'], impacts: ['admin', 'estimate'], tags: ['functional'] }),

    // ───────────────────────── CONTENT & VISIBILITY ─────────────────────────
    Q_({ id: 'q_content_updates', priority: 'P1', category: 'Content', type: 'single',
      text: 'Who will update the content after launch, and how often?',
      options: [
        ['self_often', 'We will, weekly or more often'],
        ['self_rare', 'We will, occasionally'],
        ['developer', 'We would prefer the developer to handle updates'],
        ['none', 'Content will rarely change']
      ],
      when: { any: [{ fact: 'cap.content', truthy: true }, { fact: 'cap.blog', truthy: true }, { fact: 'outcome', in: ['presence', 'learn'] }] },
      need: { base: 0.4, types: { corporate: 1, portfolio: 0.9, blog: 1, learning: 0.8 }, caps: { blog: 1, content: 0.8 } },
      resolves: ['content.editing'], impacts: ['cms', 'architecture'], tags: ['content'] }),
    Q_({ id: 'q_seo', priority: 'P1', category: 'Visibility', type: 'single',
      text: 'How important is it that people find this on Google?',
      options: [
        ['critical', 'Critical: most customers will find us through search'],
        ['helpful', 'Helpful but not essential'],
        ['not', 'Not important: users will be invited or are internal']
      ],
      when: { any: [{ fact: 'users', includesAny: ['public', 'customers'] }, { fact: 'outcome', in: ['presence', 'sell'] }] },
      need: { base: 0.7, types: { internal_tool: 0.1, dashboard: 0.15 } },
      resolves: ['seo'], impacts: ['frontend', 'architecture', 'performance'], tags: ['performance'] }),
    Q_({ id: 'q_content_ready', priority: 'P2', category: 'Content', type: 'single',
      text: 'Will the text, images and other content be ready?',
      options: [['ready', 'Yes, it is ready'], ['partial', 'Some of it'], ['none', 'No, we need help creating it']],
      when: { any: [{ fact: 'cap.content', truthy: true }, { fact: 'cap.blog', truthy: true }, { type: ['corporate', 'portfolio', 'blog', 'learning'] }] },
      need: { base: 0.5, types: { corporate: 0.9, portfolio: 0.8 } },
      resolves: ['content.ready'], impacts: ['timeline', 'estimate', 'risk'], tags: ['content'] }),
    Q_({ id: 'q_design', priority: 'P2', category: 'Design', type: 'single',
      text: 'Do you already have a brand and designs?',
      options: [
        ['full', 'Yes: brand guidelines and screen designs'],
        ['brand', 'Logo and colours only'],
        ['none', 'Nothing yet, we need design help']
      ],
      need: { base: 0.5, types: { corporate: 0.8, portfolio: 0.8, internal_tool: 0.3 } },
      resolves: ['design.assets'], impacts: ['estimate', 'timeline'], tags: ['design'] }),
    Q_({ id: 'q_languages', priority: 'P2', category: 'Content', type: 'single',
      text: 'Which languages does it need to support?',
      options: [['one', 'One language'], ['few', '2 to 3 languages'], ['many', 'Many languages'], ['rtl', 'Includes right-to-left (Arabic, Urdu, Hebrew)']],
      when: { any: [{ fact: 'cap.multilang', truthy: true }] },
      need: { base: 0.8 },
      resolves: ['languages'], impacts: ['frontend', 'content', 'estimate'], tags: ['content'] }),

    // ───────────────────────── SCALE & BEHAVIOUR ─────────────────────────
    Q_({ id: 'q_scale', priority: 'P1', category: 'Usage', type: 'single',
      text: 'Roughly how many people will use it in the first year?',
      options: [['tiny', 'Under 100'], ['small', '100 to 1,000'], ['medium', '1,000 to 10,000'], ['large', '10,000 to 100,000'], ['huge', 'More than 100,000']],
      need: { base: 0.75, types: { portfolio: 0.25, corporate: 0.35 } },
      resolves: ['scale.users'], impacts: ['performance', 'scalability', 'hosting', 'cost'], tags: ['scalability'] }),
    Q_({ id: 'q_peaks', priority: 'P2', category: 'Usage', type: 'single',
      text: 'Will there be moments when many people use it at the same time?',
      options: [
        ['no', 'No, usage is fairly steady'],
        ['some', 'Some busy periods (e.g. weekday mornings)'],
        ['spikes', 'Big spikes (e.g. ticket launches, results day, sales campaigns)']
      ],
      when: { any: [{ fact: 'scale.users', in: ['medium', 'large', 'huge'] }, { fact: 'cap.events', truthy: true }, { type: ['event'] }] },
      need: { base: 0.45, types: { event: 1, ecommerce: 0.7, learning: 0.6 }, caps: { events: 1 } },
      resolves: ['scale.peaks'], impacts: ['performance', 'caching', 'hosting'], tags: ['performance'] }),
    Q_({ id: 'q_realtime', priority: 'P2', category: 'Usage', type: 'single',
      text: 'Do people need to see changes instantly, without refreshing?',
      options: [
        ['no', 'No, a short delay or a refresh is fine'],
        ['some', 'For a few things (e.g. new messages, order status)'],
        ['core', 'Yes, it is central (e.g. live chat, live tracking, live dashboards)']
      ],
      when: { any: [{ fact: 'cap.messaging', truthy: true }, { fact: 'cap.maps', truthy: true }, { fact: 'cap.dashboards', truthy: true, strong: true }, { fact: 'cap.community', truthy: true, strong: true }, { fact: 'cap.ordering', truthy: true }, { fact: 'cap.realtime', truthy: true }] },
      need: { base: 0.6, caps: { messaging: 0.9, ordering: 0.8, realtime: 1 } },
      resolves: ['cap.realtime'], impacts: ['architecture', 'backend', 'hosting', 'caching'], tags: ['performance'] }),
    Q_({ id: 'q_availability', priority: 'P2', category: 'Reliability', type: 'single',
      text: 'How serious would it be if the system was unavailable for an hour?',
      options: [
        ['minor', 'Minor: people can come back later'],
        ['costly', 'Costly: we would lose sales, bookings or productivity'],
        ['critical', 'Critical: health, safety or major operations depend on it']
      ],
      need: { base: 0.35, types: { healthcare: 0.8, logistics: 0.8, ecommerce: 0.6, saas: 0.7, finance: 0.8 }, caps: { payments: 0.6, bookings: 0.55 } },
      resolves: ['availability'], impacts: ['hosting', 'monitoring', 'architecture', 'cost'], tags: ['availability'] }),
    Q_({ id: 'q_offline', priority: 'P2', category: 'Platforms', type: 'single',
      text: 'Will people need to use it without an internet connection?',
      options: [['no', 'No'], ['sometimes', 'Sometimes (patchy connection)'], ['yes', 'Yes, regularly (field work, remote areas)']],
      when: { any: [{ fact: 'platforms', includesAny: ['ios', 'android', 'kiosk', 'desktop_app'] }, { type: ['logistics'] }, { fact: 'cap.offline', truthy: true }] },
      need: { base: 0.6 },
      resolves: ['cap.offline'], impacts: ['mobile', 'database', 'architecture'], tags: ['platform'] }),
    Q_({ id: 'q_app_store', priority: 'P1', category: 'Platforms', type: 'single',
      text: 'Do you specifically need an app in the App Store / Play Store, or would a phone-friendly website work to start?',
      helpText: 'Store apps usually add significant cost and time. A phone-friendly website can come first.',
      options: [['store', 'We need store apps in the first version'], ['either', 'A phone-friendly website is fine to start']],
      when: { any: [{ fact: 'platforms', includesAny: ['ios', 'android'] }] },
      need: { base: 1 },
      resolves: ['mobile.native'], impacts: ['mobile', 'cost', 'timeline', 'architecture'], tags: ['platform'] }),

    // ───────────────────────── PAYMENTS (optional module) ─────────────────────────
    Q_({ id: 'q_payments', priority: 'P1', category: 'Payments', type: 'yesno',
      text: 'Will people pay money through the system?',
      need: { base: 0.3, types: { ecommerce: 1, marketplace: 1, booking: 0.8, saas: 0.9, learning: 0.8, event: 0.8, restaurant: 0.9, portfolio: 0.05, corporate: 0.15, blog: 0.15, internal_tool: 0.1, dashboard: 0.15 },
        caps: { commerce: 1, catalog: 0.6, bookings: 0.75, subscriptions: 1, marketplace: 1, ordering: 1, events: 0.75, payments: 1 } },
      followUps: ['q_pay_type', 'q_regions', 'q_pay_methods', 'q_payouts', 'q_pay_extras', 'q_pay_existing'],
      resolves: ['cap.payments'], impacts: ['payments', 'security', 'compliance', 'architecture'], tags: ['functional', 'security'] }),
    Q_({ id: 'q_pay_type', priority: 'P1', category: 'Payments', type: 'multi', other: true,
      text: 'What will people pay for?',
      options: [
        ['one_time', 'One-time purchases (products, tickets, services)'],
        ['subscription', 'Subscriptions or memberships (recurring)'],
        ['deposit', 'Booking fees or deposits'],
        ['donation', 'Donations'],
        ['invoice', 'Paying invoices you send'],
        ['marketplace', 'Paying other sellers/providers through your platform (you take a commission)']
      ],
      when: { all: [{ fact: 'cap.payments', truthy: true, strong: true }] },
      need: { base: 1 },
      resolves: ['pay.types'], impacts: ['payments', 'architecture', 'database'], tags: ['functional'] }),
    Q_({ id: 'q_regions', priority: 'P1', category: 'Audience', type: 'multi',
      text: 'Where are your users and paying customers located?',
      options: [
        ['india', 'India'], ['us', 'United States'], ['uk', 'United Kingdom'], ['eu', 'European Union'],
        ['mena', 'Middle East'], ['apac', 'Asia-Pacific (other)'], ['latam', 'Latin America'], ['africa', 'Africa'], ['global', 'Worldwide']
      ],
      need: { base: 0.3, types: { healthcare: 0.8, finance: 0.9, government: 0.9 }, caps: { payments: 1, sensitiveData: 0.8, multilang: 0.7 } },
      resolves: ['regions'], impacts: ['payments', 'compliance', 'hosting', 'cdn'], tags: ['compliance'] }),
    Q_({ id: 'q_pay_methods', priority: 'P2', category: 'Payments', type: 'multi',
      text: 'Which ways of paying are important to your customers?',
      options: [
        ['cards', 'Credit / debit cards'], ['upi', 'UPI'], ['netbanking', 'Net banking'],
        ['wallets', 'Wallets (e.g. Paytm, PhonePe)'], ['apple_google', 'Apple Pay / Google Pay'],
        ['paypal', 'PayPal'], ['bank_transfer', 'Bank transfer'], ['cod', 'Cash on delivery / pay in person']
      ],
      when: { all: [{ fact: 'cap.payments', truthy: true, strong: true }] },
      need: { base: 0.8 },
      resolves: ['pay.methods'], impacts: ['payments'], tags: ['functional'] }),
    Q_({ id: 'q_payouts', priority: 'P1', category: 'Payments', type: 'single',
      text: 'Does money need to be passed on to other sellers or providers?',
      options: [
        ['no', 'No, all money goes to one business'],
        ['yes_auto', 'Yes, automatically split and paid out'],
        ['yes_manual', 'Yes, but we will pay them manually']
      ],
      when: { all: [{ fact: 'cap.payments', truthy: true, strong: true }] },
      need: { base: 0.15, types: { marketplace: 1, booking: 0.45, event: 0.4 }, caps: { marketplace: 1, listings: 0.6 } },
      resolves: ['pay.payouts'], impacts: ['payments', 'compliance', 'architecture'], tags: ['functional', 'compliance'] }),
    Q_({ id: 'q_pay_extras', priority: 'P2', category: 'Payments', type: 'multi',
      text: 'Which of these will you need to handle?',
      options: [
        ['refunds', 'Refunds or cancellations'], ['tax_invoices', 'Tax invoices (GST / VAT)'],
        ['coupons', 'Discounts or coupon codes'], ['partial', 'Part payments or instalments'], ['none', 'None of these']
      ],
      when: { all: [{ fact: 'cap.payments', truthy: true, strong: true }] },
      need: { base: 0.6 },
      resolves: ['pay.extras'], impacts: ['payments', 'estimate'], tags: ['functional'] }),
    Q_({ id: 'q_pay_existing', priority: 'P3', category: 'Payments', type: 'single', other: true,
      text: 'Do you already have an account with a payment company?',
      helpText: 'If yes, tell us which one using "Other".',
      options: [['none', 'No'], ['yes', 'Yes']],
      when: { all: [{ fact: 'cap.payments', truthy: true, strong: true }] },
      need: { base: 0.7 },
      resolves: ['pay.existing'], impacts: ['payments'], tags: ['integration'] }),

    // ───────────────────────── DATA & SENSITIVITY ─────────────────────────
    Q_({ id: 'q_data', priority: 'P1', category: 'Information', type: 'multi', other: true,
      text: 'What information will the system need to keep?',
      options: [
        ['contacts', 'Names and contact details'], ['profiles', 'User profiles and preferences'],
        ['transactions', 'Orders, payments or transactions'], ['bookings', 'Bookings or schedules'],
        ['items', 'Products, items, inventory or listings'], ['documents', 'Documents, files or media'],
        ['health', 'Health or medical information'], ['financial', 'Financial or banking details'],
        ['identity', 'ID documents (e.g. Aadhaar, passport)'], ['academic', 'Student or academic records'],
        ['children', 'Information about children'], ['location', 'Locations or addresses'],
        ['messages', 'Messages or conversations'], ['usage', 'Usage or activity history']
      ],
      need: { base: 0.65, types: { portfolio: 0.15, corporate: 0.3, blog: 0.25 }, caps: { accounts: 0.9 } },
      resolves: ['data.types'], impacts: ['database', 'security', 'compliance', 'storage'], tags: ['data', 'security'] }),
    Q_({ id: 'q_sensitive', priority: 'P1', category: 'Information', type: 'yesno',
      text: 'Will it handle personal or sensitive information such as health, financial, ID or children\'s data?',
      need: { base: 0.35, types: { healthcare: 1, finance: 1, government: 1, learning: 0.7, internal_tool: 0.6, portfolio: 0.05 }, caps: { accounts: 0.65, sensitiveData: 1 } },
      resolves: ['cap.sensitiveData'], impacts: ['security', 'compliance', 'hosting', 'architecture'], tags: ['security', 'compliance'] }),
    Q_({ id: 'q_compliance', priority: 'P1', category: 'Information', type: 'multi',
      text: 'Are there any rules, regulations or certifications you know you must follow?',
      helpText: 'Only what you already know about. We will flag anything that needs a specialist review.',
      options: [
        ['none_known', 'None that we know of'],
        ['health', 'Healthcare regulations (e.g. HIPAA, ABDM, NHS standards)'],
        ['payments_reg', 'Card payment rules (PCI DSS)'],
        ['privacy', 'Privacy laws (e.g. India DPDP Act, GDPR)'],
        ['gov', 'Government or public-sector standards'],
        ['accessibility_law', 'Accessibility required by contract or law'],
        ['industry', 'Industry-specific rules (finance, insurance, education)']
      ],
      when: { any: [{ fact: 'cap.sensitiveData', truthy: true }, { type: ['healthcare', 'finance', 'government'] }] },
      need: { base: 0.9 },
      resolves: ['compliance'], impacts: ['security', 'compliance', 'hosting', 'risk'], tags: ['compliance'] }),
    Q_({ id: 'q_hosting_policy', priority: 'P2', category: 'Information', type: 'single',
      text: 'Are there rules about where your data or services must be hosted?',
      options: [
        ['none', 'No rules'],
        ['own_cloud', 'Must use our company cloud account (AWS, Azure or Google Cloud)'],
        ['in_country', 'Data must stay in our country'],
        ['on_prem', 'Must run on our own servers']
      ],
      need: { base: 0.2, types: { internal_tool: 0.6, government: 1, healthcare: 0.75, finance: 0.85, erp: 0.6 }, caps: { sensitiveData: 0.6 } },
      resolves: ['hosting.policy'], impacts: ['hosting', 'cloud', 'compliance'], tags: ['deployment'] }),
    Q_({ id: 'q_uploads', priority: 'P2', category: 'Information', type: 'single',
      text: 'What kind of files will people upload?',
      options: [
        ['docs_images', 'Documents and photos (a few MB each)'],
        ['large_media', 'Large videos or audio'],
        ['bulk', 'Large numbers of files (thousands per month)']
      ],
      when: { any: [{ fact: 'cap.uploads', truthy: true, strong: true }, { fact: 'data.types', includesAny: ['documents'] }] },
      need: { base: 0.7 },
      resolves: ['files.size'], impacts: ['storage', 'cost', 'security'], tags: ['data'] }),

    // ───────────────────────── COMMUNICATION & INTEGRATIONS ─────────────────────────
    Q_({ id: 'q_notify', priority: 'P2', category: 'Communication', type: 'multi',
      text: 'How should people be notified about important updates?',
      options: [
        ['email', 'Email'], ['sms', 'SMS'], ['whatsapp', 'WhatsApp'], ['push', 'Mobile push notifications'],
        ['in_app', 'Inside the app only'], ['none', 'No notifications needed']
      ],
      when: { any: [{ fact: 'cap.notifications', truthy: true }, { fact: 'cap.bookings', truthy: true, strong: true }, { fact: 'cap.ordering', truthy: true }, { fact: 'cap.payments', truthy: true, strong: true }, { fact: 'cap.workflows', truthy: true, strong: true }, { fact: 'cap.events', truthy: true }] },
      need: { base: 0.6, caps: { notifications: 1, bookings: 0.85 } },
      resolves: ['notify.channels'], impacts: ['integration', 'email', 'sms', 'cost'], tags: ['integration'] }),
    Q_({ id: 'q_existing_detail', priority: 'P1', category: 'Current situation', type: 'long',
      text: 'Which existing system(s) are involved, and what should happen to them?',
      placeholder: 'e.g. We use Excel for stock and Tally for accounts. Stock should move here; Tally stays.',
      when: { all: [{ fact: 'existing', in: ['replace', 'connect', 'both'] }] },
      need: { base: 0.9 },
      resolves: ['existing.detail'], impacts: ['integration', 'migration'], tags: ['integration'] }),
    Q_({ id: 'q_migration', priority: 'P1', category: 'Current situation', type: 'single',
      text: 'Is there existing data that must be moved into the new system?',
      options: [['none', 'No'], ['small', 'Yes, a small amount (spreadsheets, a few hundred records)'], ['large', 'Yes, a lot (years of records, multiple systems)']],
      when: { all: [{ fact: 'existing', in: ['replace', 'both'] }] },
      need: { base: 0.9 },
      resolves: ['migration'], impacts: ['database', 'estimate', 'risk'], tags: ['data'] }),
    Q_({ id: 'q_integrations', priority: 'P1', category: 'Current situation', type: 'multi', other: true,
      text: 'Which tools does it need to work with?',
      options: [
        ['google', 'Google Workspace (Gmail, Calendar, Sheets)'], ['microsoft', 'Microsoft 365 / Outlook / Teams'],
        ['accounting', 'Accounting software (Tally, Zoho Books, QuickBooks, Xero)'], ['crm', 'CRM (HubSpot, Zoho CRM, Salesforce)'],
        ['erp', 'ERP (SAP, Odoo, etc.)'], ['shipping', 'Courier / shipping (Shiprocket, Delhivery, etc.)'],
        ['whatsapp_biz', 'WhatsApp Business'], ['social_login', 'Sign in with Google / Apple / etc.'],
        ['calendar', 'Calendar sync'], ['gov_api', 'Government services (e.g. DigiLocker, GST)'],
        ['spreadsheets', 'Spreadsheets / Excel'], ['custom_api', 'Another system with an API'], ['none', 'None']
      ],
      when: { any: [{ fact: 'existing', in: ['connect', 'both'] }, { type: ['internal_tool', 'erp', 'crm', 'automation'] }, { fact: 'outcome', in: ['operations', 'automate'] }, { fact: 'cap.integrations', truthy: true }] },
      need: { base: 0.6, types: { internal_tool: 0.9, erp: 1, crm: 1, automation: 1 } },
      resolves: ['integrations.list'], impacts: ['integration', 'estimate', 'risk', 'architecture'], tags: ['integration'] }),
    Q_({ id: 'q_api_access', priority: 'P3', category: 'Current situation', type: 'single',
      text: 'Will other systems or partners need to connect to your data?',
      options: [['no', 'No'], ['partners', 'Yes, specific partners or our other systems'], ['public', 'Yes, a public API for outside developers']],
      need: { base: 0.15, types: { saas: 0.6, api_platform: 1, logistics: 0.6, data_platform: 0.7, marketplace: 0.4 } },
      resolves: ['cap.publicApi'], impacts: ['api', 'architecture', 'security'], tags: ['integration'] }),

    // ───────────────────────── AI (optional module) ─────────────────────────
    Q_({ id: 'q_ai_needed', priority: 'P1', category: 'Smart features', type: 'yesno',
      text: 'You mentioned smart or automated features. Should the first version include them?',
      helpText: 'For example: answering questions from your documents, summaries, or recommendations.',
      when: { all: [{ fact: 'cap.ai', truthy: true }] },
      need: { base: 0.9 },
      resolves: ['cap.ai'], impacts: ['ai', 'architecture', 'cost', 'risk'], tags: ['functional'] }),
    Q_({ id: 'q_ai_purpose', priority: 'P1', category: 'Smart features', type: 'multi', other: true,
      text: 'What should the smart/automated part do?',
      options: [
        ['doc_qa', 'Answer questions using our documents'], ['summarize', 'Summarise or extract information from documents'],
        ['classify', 'Sort, tag or route items automatically'], ['generate', 'Write or draft content'],
        ['recommend', 'Recommend items to users'], ['predict', 'Predict numbers or outcomes (forecasting)'],
        ['vision', 'Read images, scans or handwriting'], ['chat', 'Chat assistant for customers']
      ],
      when: { all: [{ fact: 'cap.ai', truthy: true, strong: true }] },
      need: { base: 1 },
      resolves: ['ai.purposes'], impacts: ['ai', 'vectordb', 'architecture'], tags: ['functional'] }),
    Q_({ id: 'q_ai_private', priority: 'P1', category: 'Smart features', type: 'single',
      text: 'Will the smart features use confidential or private information?',
      options: [
        ['no', 'No, public information only'], ['internal', 'Internal business documents'],
        ['personal', 'Customer or personal data'], ['regulated', 'Regulated data (health, financial, legal)']
      ],
      when: { all: [{ fact: 'cap.ai', truthy: true, strong: true }] },
      need: { base: 1 },
      resolves: ['ai.privacy'], impacts: ['ai', 'security', 'compliance', 'hosting'], tags: ['security'] }),
    Q_({ id: 'q_ai_accuracy', priority: 'P1', category: 'Smart features', type: 'single',
      text: 'What happens if the smart feature gets something wrong?',
      options: [
        ['minor', 'Minor inconvenience'], ['reviewed', 'A person reviews results before they are used'],
        ['serious', 'It could cause serious harm or financial/legal problems']
      ],
      when: { all: [{ fact: 'cap.ai', truthy: true, strong: true }] },
      need: { base: 0.9 },
      resolves: ['ai.criticality'], impacts: ['ai', 'risk', 'architecture'], tags: ['functional'] }),
    Q_({ id: 'q_ai_volume', priority: 'P2', category: 'Smart features', type: 'single',
      text: 'How often will the smart features be used?',
      options: [['low', 'A few times a day'], ['medium', 'Hundreds of times a day'], ['high', 'Thousands or more per day']],
      when: { all: [{ fact: 'cap.ai', truthy: true, strong: true }] },
      need: { base: 0.7 },
      resolves: ['ai.volume'], impacts: ['ai', 'cost'], tags: ['performance'] }),

    // ───────────────────────── DOMAIN-SPECIFIC FOLLOW-UPS (activated by evidence) ─────────────────────────
    Q_({ id: 'q_booking_rules', priority: 'P1', category: 'Bookings', type: 'multi',
      text: 'How should bookings work?',
      options: [
        ['choose_provider', 'Choose a specific person (e.g. doctor, tutor, stylist)'], ['slots', 'Fixed time slots'],
        ['capacity', 'Limited seats or capacity (classes, events)'], ['locations', 'Multiple locations'],
        ['reminders', 'Reminders before the booking'], ['reschedule', 'Cancel or reschedule online'],
        ['pay_upfront', 'Pay or leave a deposit when booking'], ['approval', 'Bookings need manual approval'], ['waitlist', 'Waiting list']
      ],
      when: { all: [{ fact: 'cap.bookings', truthy: true, strong: true }] },
      need: { base: 1 },
      resolves: ['booking.rules'], impacts: ['database', 'notifications', 'estimate'], tags: ['functional'] }),
    Q_({ id: 'q_catalog_size', priority: 'P2', category: 'Catalogue', type: 'single',
      text: 'Roughly how many products, items or listings will there be?',
      options: [['s', 'Under 100'], ['m', '100 to 1,000'], ['l', '1,000 to 50,000'], ['xl', 'More than 50,000']],
      when: { all: [{ fact: 'cap.catalog', truthy: true }] },
      need: { base: 0.75 },
      resolves: ['catalog.size'], impacts: ['search', 'database', 'performance'], tags: ['data'] }),
    Q_({ id: 'q_fulfilment', priority: 'P2', category: 'Orders', type: 'multi',
      text: 'How do customers receive what they buy?',
      options: [
        ['pickup', 'Collect in person'], ['own_delivery', 'Our own delivery'], ['courier', 'Courier / shipping partner'],
        ['digital', 'Digital delivery (downloads, access)'], ['service', 'It is a service delivered in person']
      ],
      when: { any: [{ fact: 'cap.commerce', truthy: true, strong: true }, { fact: 'cap.ordering', truthy: true, strong: true }] },
      need: { base: 0.8 },
      resolves: ['fulfilment'], impacts: ['integration', 'maps', 'estimate'], tags: ['functional'] }),
    Q_({ id: 'q_inventory', priority: 'P2', category: 'Orders', type: 'single',
      text: 'Do you need to track stock or quantities?',
      options: [['no', 'No'], ['simple', 'Yes, simple stock counts'], ['advanced', 'Yes, across multiple locations or warehouses']],
      when: { any: [{ fact: 'cap.catalog', truthy: true, strong: true }, { fact: 'cap.commerce', truthy: true }, { fact: 'cap.inventory', truthy: true }, { type: ['erp', 'restaurant'] }] },
      need: { base: 0.6, types: { erp: 1, internal_tool: 0.8 }, caps: { inventory: 1 } },
      resolves: ['cap.inventory'], impacts: ['database', 'estimate'], tags: ['functional'] }),
    Q_({ id: 'q_order_flow', priority: 'P1', category: 'Orders', type: 'multi',
      text: 'How will customers order?',
      options: [
        ['qr_dinein', 'Scan a QR code at the table'], ['takeaway', 'Order ahead for pickup'], ['delivery', 'Order for delivery'],
        ['reservations', 'Reserve a table'], ['kitchen', 'Orders go straight to a kitchen screen']
      ],
      when: { any: [{ type: ['restaurant'] }, { fact: 'cap.ordering', truthy: true }] },
      need: { base: 1 },
      resolves: ['ordering.flow'], impacts: ['realtime', 'payments', 'estimate'], tags: ['functional'] }),
    Q_({ id: 'q_learning', priority: 'P1', category: 'Learning', type: 'multi',
      text: 'Which learning features are essential?',
      options: [
        ['video', 'Video lessons'], ['quizzes', 'Quizzes or assessments'], ['certificates', 'Certificates'],
        ['live', 'Live classes'], ['progress', 'Progress tracking'], ['assignments', 'Assignments and grading'], ['discussion', 'Discussions']
      ],
      when: { any: [{ type: ['learning'] }, { fact: 'cap.education', truthy: true }] },
      need: { base: 1 },
      resolves: ['learning.features'], impacts: ['storage', 'estimate', 'architecture'], tags: ['functional'] }),
    Q_({ id: 'q_listings', priority: 'P1', category: 'Catalogue', type: 'single',
      text: 'Who creates the listings or items shown to users?',
      options: [['us', 'Only our team'], ['users', 'Users / sellers create them'], ['both', 'Both']],
      when: { any: [{ fact: 'cap.listings', truthy: true }, { type: ['marketplace', 'real_estate'] }] },
      need: { base: 0.9 },
      resolves: ['listings.creator'], impacts: ['authorization', 'workflows', 'estimate'], tags: ['functional'] }),
    Q_({ id: 'q_events', priority: 'P1', category: 'Events', type: 'multi',
      text: 'What does the event experience need?',
      options: [
        ['registration', 'Registration forms'], ['tickets', 'Paid or free tickets'], ['checkin', 'QR check-in at the venue'],
        ['schedule', 'Agenda / schedule'], ['teams', 'Team or group registrations'], ['certificates', 'Participation certificates'],
        ['results', 'Results or leaderboards']
      ],
      when: { any: [{ type: ['event'] }, { fact: 'cap.events', truthy: true }] },
      need: { base: 1 },
      resolves: ['events.features'], impacts: ['estimate', 'payments', 'performance'], tags: ['functional'] }),
    Q_({ id: 'q_community', priority: 'P1', category: 'Community', type: 'single',
      text: 'Will people post content that others can see?',
      options: [
        ['no', 'No'], ['moderated', 'Yes, we review it before it appears'],
        ['post_moderate', 'Yes, it appears immediately and we remove problems']
      ],
      when: { any: [{ type: ['community'] }, { fact: 'cap.community', truthy: true }, { fact: 'cap.reviews', truthy: true, strong: true }] },
      need: { base: 0.9 },
      resolves: ['community.moderation'], impacts: ['security', 'workflows', 'estimate'], tags: ['functional', 'security'] }),
    Q_({ id: 'q_location', priority: 'P2', category: 'Location', type: 'multi',
      text: 'What should the location features do?',
      options: [
        ['show_map', 'Show places on a map'], ['near_me', 'Find things near me'], ['live_tracking', 'Live tracking (e.g. deliveries)'],
        ['zones', 'Delivery zones or distance pricing'], ['routes', 'Routes or directions']
      ],
      when: { all: [{ fact: 'cap.maps', truthy: true, strong: true }] },
      need: { base: 0.9 },
      resolves: ['maps.features'], impacts: ['maps', 'database', 'realtime'], tags: ['functional'] }),
    Q_({ id: 'q_reports', priority: 'P2', category: 'Insights', type: 'long',
      text: 'Which numbers or reports matter most to you?',
      placeholder: 'e.g. Daily sales by branch, stock running low, staff utilisation.',
      when: { any: [{ fact: 'cap.dashboards', truthy: true, strong: true }, { fact: 'outcome', in: ['insight'] }] },
      need: { base: 0.7 },
      resolves: ['reports.detail'], impacts: ['database', 'analytics'], tags: ['analytics'] }),

    // ───────────────────────── OPERATIONS & SUCCESS ─────────────────────────
    Q_({ id: 'q_accessibility', priority: 'P2', category: 'Accessibility', type: 'single',
      text: 'Do you have specific accessibility needs?',
      options: [
        ['general', 'No specific requirement: follow good practice'],
        ['important', 'Many of our users have accessibility needs'],
        ['contract', 'Required by contract, law or policy']
      ],
      need: { base: 0.3, types: { government: 1, learning: 0.7, healthcare: 0.7 } },
      resolves: ['a11y.level'], impacts: ['design', 'testing', 'estimate'], tags: ['accessibility'] }),
    Q_({ id: 'q_maintenance', priority: 'P2', category: 'After launch', type: 'single',
      text: 'After launch, who will look after the system?',
      options: [
        ['developer', 'The developer (ongoing support)'], ['inhouse', 'Our own technical team'],
        ['nontech', 'We have no technical staff'], ['undecided', 'Not decided yet']
      ],
      need: { base: 0.5 },
      resolves: ['maintenance'], impacts: ['hosting', 'technology', 'operations'], tags: ['maintenance'] }),
    Q_({ id: 'q_deadline_fixed', priority: 'P2', category: 'Timeline', type: 'single',
      text: 'Is the launch date fixed?',
      options: [['fixed', 'Yes, tied to an event, season or commitment'], ['target', 'It is a target with some flexibility'], ['flexible', 'No, it is flexible']],
      when: { all: [{ fact: 'timeline', in: ['lt1', 'm1_3'] }] },
      need: { base: 0.8 },
      resolves: ['timeline.fixed'], impacts: ['scope', 'risk'], tags: ['timeline'] }),
    Q_({ id: 'q_success', priority: 'P2', category: 'Vision', type: 'short', notSure: true,
      text: 'How will you know it is successful six months after launch?',
      placeholder: 'e.g. 50% of appointments booked online; fewer phone calls.',
      need: { base: 0.4 },
      resolves: ['success'], impacts: ['analytics', 'acceptance'], tags: ['business'],
      validation: { maxLength: APP.MAX_SHORT_TEXT } })
  ];

  var BY_ID = {};
  QUESTIONS.forEach(function (q) { BY_ID[q.id] = q; });

  /** Convert a developer-added custom question row into the engine's question shape. */
  function fromCustom_(row) {
    return Q_({
      id: row.id, category: row.category || 'Custom', text: row.text, description: row.description || '',
      type: row.type || 'long', priority: row.priority || 'P1',
      options: (row.options || []).map(function (o) { return [o.value || o, o.label || o]; }),
      notSure: row.allowNotSure !== false, need: { base: 1 }, resolves: ['custom.' + row.id],
      impacts: ['developer-defined'], tags: [String(row.requirementCategory || 'Business').toLowerCase()]
    });
  }

  return {
    all: function () { return QUESTIONS; },
    get: function (id) { return BY_ID[id] || null; },
    core: function () { return U.sortBy(QUESTIONS.filter(function (q) { return q.stage === 'core'; }), function (q) { return q.order; }); },
    fromCustom: fromCustom_,
    impactFor: function (p) { return IMPACT[p] || 0.5; },
    /** Client-safe projection (strips internal metadata). */
    toClient: function (q, developer) {
      var base = {
        id: q.id, category: q.category, text: q.text, description: q.description, helpText: q.helpText,
        type: q.type, options: q.options, required: q.required, allowNotSure: q.allowNotSure,
        allowOther: q.allowOther, placeholder: q.placeholder, validation: q.validation, stage: q.stage
      };
      if (developer) {
        base.priority = q.priority; base.technicalImpacts = q.technicalImpacts; base.requirementTags = q.requirementTags;
        base.resolves = q.resolves; base.followUpQuestions = q.followUpQuestions; base.importance = q.importance;
      }
      return base;
    }
  };
})();

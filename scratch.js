
        var state = { projectId: readStoredId_(), data: null, busy: false };

        function readStoredId_() {
            try { return localStorage.getItem('projectScopeId'); } catch (e) { return null; }
        }
        function storeId_(id) {
            // If storage is blocked (some sandboxed iframes), the id lives only for this page view.
            try { localStorage.setItem('projectScopeId', id); } catch (e) {}
        }
        function clearStoredId_() {
            try { localStorage.removeItem('projectScopeId'); } catch (e) {}
        }

        function esc(value) {
            return String(value === null || value === undefined ? '' : value).replace(/[&<>"']/g, function (c) {
                return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
            });
        }

        function cleanError_(err) {
            var msg = (err && err.message) || String(err);
            return msg.replace(/^Error:\s*/, '');
        }

        function findQuestion_(id) {
            var list = (state.data && state.data.nextQuestions) || [];
            for (var i = 0; i < list.length; i++) {
                if (list[i].id === id) return list[i];
            }
            return null;
        }

        function init() {
            renderLoading();
            loadState_(state.projectId);
        }

        function loadState_(projectId) {
            google.script.run
                .withSuccessHandler(onStateLoaded)
                .withFailureHandler(onLoadError)
                .getProjectState(projectId || null);
        }

        function onLoadError(err) {
            var msg = cleanError_(err);
            if (msg.indexOf('Project not found') !== -1) {
                // The stored project no longer exists (for example, the sheet was reset). Start over.
                state.projectId = null;
                clearStoredId_();
                loadState_(null);
                return;
            }
            showFatal_(msg);
        }

        function onStateLoaded(serverState) {
            state.data = serverState;
            state.busy = false;
            if (state.projectId !== serverState.project.id) {
                state.projectId = serverState.project.id;
                storeId_(state.projectId);
            }
            render();
        }

        function onAppClick_(e) {
            var btn = e.target.closest('button[data-action]');
            if (!btn) return;
            var action = btn.getAttribute('data-action');
            var qid = btn.getAttribute('data-q');
            if (action === 'submit') submitAnswer(qid, false);
            else if (action === 'notsure') submitAnswer(qid, true);
            else if (action === 'restart') restart_();
        }

        function restart_() {
            state.projectId = null;
            state.data = null;
            clearStoredId_();
            renderLoading();
            loadState_(null);
        }

        function submitAnswer(questionId, notSure) {
            if (state.busy) return;
            var q = findQuestion_(questionId);
            var card = document.getElementById('q-' + questionId);
            if (!q || !card) return;

            var value = notSure ? state.data.notSure : readValue_(q, card);
            if (value === null) {
                showCardError_(card, 'Please choose or write an answer, or use "Not sure yet".');
                return;
            }

            state.busy = true;
            card.classList.add('busy');
            hideCardError_(card);

            google.script.run
                .withSuccessHandler(onStateLoaded)
                .withFailureHandler(function (err) {
                    state.busy = false;
                    card.classList.remove('busy');
                    showCardError_(card, cleanError_(err) || 'Could not save your answer. Please try again.');
                })
                .submitAnswer(state.projectId, questionId, value);
        }

        /** Reads the answer from a question card. Returns null when nothing usable was entered. */
        function readValue_(q, card) {
            var otherInput = card.querySelector('.other-text');
            var otherText = otherInput ? otherInput.value.trim() : '';

            if (q.type === 'single' || q.type === 'yesno') {
                var checked = card.querySelector('input[type="radio"]:checked');
                if (!checked) return null;
                if (checked.classList.contains('other-option')) return otherText || null;
                return checked.value;
            }

            if (q.type === 'multi') {
                var values = [];
                card.querySelectorAll('input[type="checkbox"]:checked').forEach(function (box) {
                    if (!box.classList.contains('other-option')) values.push(box.value);
                });
                var otherBox = card.querySelector('input[type="checkbox"].other-option');
                if (otherBox && otherBox.checked) {
                    if (!otherText) return null;
                    values.push(otherText);
                }
                return values.length ? values : null;
            }

            var textEl = card.querySelector('.answer-text');
            var text = textEl ? textEl.value.trim() : '';
            return text || null;
        }

        function showCardError_(card, message) {
            var el = card.querySelector('.card-error');
            if (!el) return;
            el.textContent = message;
            el.classList.add('show');
        }

        function hideCardError_(card) {
            var el = card.querySelector('.card-error');
            if (el) el.classList.remove('show');
        }

        function showFatal_(message) {
            document.getElementById('app').innerHTML =
                '<div class="card fatal">Something went wrong: ' + esc(message) + '. ' +
                '<div style="margin-top:1rem"><button type="button" data-action="restart">Start over</button></div></div>';
        }

        function renderLoading() {
            document.getElementById('app').innerHTML = '<div class="loading">Loading ProjectScope Engine...</div>';
        }

        function render() {
            var app = document.getElementById('app');
            var template = document.getElementById('app-template');
            app.innerHTML = '';
            app.appendChild(template.content.cloneNode(true));
            renderQuestions();
            renderAnalysis();
        }

        function renderQuestions() {
            var container = document.getElementById('questions-container');
            var next = state.data.nextQuestions || [];

            if (next.length === 0) {
                container.innerHTML =
                    '<div class="card"><h3>Discovery Complete!</h3>' +
                    '<p>We have gathered enough information to propose an architecture.</p>' +
                    '<div style="margin-top:1rem"><button type="button" data-action="restart">Start New Project</button></div></div>';
                return;
            }

            container.innerHTML = next.map(questionCardHtml_).join('');
        }

        function questionCardHtml_(q) {
            var id = esc(q.id);
            var controls = '';

            if (q.type === 'single' || q.type === 'yesno' || q.type === 'multi') {
                var inputType = q.type === 'multi' ? 'checkbox' : 'radio';
                controls = q.options.map(function (o) {
                    return optionHtml_(inputType, q.id, o.value, o.label, false);
                }).join('');
                if (q.allowOther) {
                    controls += optionHtml_(inputType, q.id, '__other__', 'Other (please specify)', true);
                    controls += '<input type="text" class="other-text" placeholder="Type your answer">';
                }
            } else if (q.type === 'long') {
                controls = '<textarea class="answer-text" rows="4" placeholder="' + esc(q.placeholder) + '"></textarea>';
            } else {
                controls = '<input type="text" class="answer-text" placeholder="' + esc(q.placeholder) + '">';
            }

            return '' +
                '<div class="question-card" id="q-' + id + '">' +
                    '<div class="q-title">' + esc(q.text) + '</div>' +
                    (q.helpText ? '<div class="q-desc">' + esc(q.helpText) + '</div>' : '') +
                    (q.description ? '<div class="q-desc">' + esc(q.description) + '</div>' : '') +
                    '<div class="options">' + controls + '</div>' +
                    '<div class="actions">' +
                        '<button type="button" data-action="submit" data-q="' + id + '">Continue</button>' +
                        (q.allowNotSure
                            ? '<button type="button" class="btn-secondary" data-action="notsure" data-q="' + id + '">Not sure yet</button>'
                            : '') +
                    '</div>' +
                    '<div class="card-error" role="alert"></div>' +
                '</div>';
        }

        function optionHtml_(inputType, questionId, value, label, isOther) {
            return '<label class="option-label">' +
                '<input type="' + inputType + '" name="ans-' + esc(questionId) + '" value="' + esc(value) + '"' +
                (isOther ? ' class="other-option"' : '') + '>' +
                '<span>' + esc(label) + '</span>' +
            '</label>';
        }

        function renderAnalysis() {
            var container = document.getElementById('analysis-content');
            var data = state.data;
            var answers = data.answers || [];
            var facts = data.facts || {};
            var requirements = data.requirements || [];
            var arch = data.architecture || {};

            var html =
                '<div class="stat-row"><span>Questions Answered</span><span class="stat-val">' + answers.length + '</span></div>' +
                '<div class="stat-row"><span>Facts Extracted</span><span class="stat-val">' + Object.keys(facts).length + '</span></div>' +
                '<div class="stat-row"><span>Requirements Drafted</span><span class="stat-val">' + requirements.length + '</span></div>';

            if (arch.patterns && arch.patterns.length > 0) {
                html +=
                    '<h3 style="margin-top: 1.5rem; font-size: 1rem;">Top Architecture Pattern</h3>' +
                    '<div class="tag" style="background: var(--success-color); color: white; border: none; margin: 0;">' +
                        esc(arch.patterns[0].pattern) +
                    '</div>';
            }

            var stack = arch.recommendedTechStack;
            if (stack) {
                html += '<h3 style="margin-top: 1.5rem; font-size: 1rem;">Predicted Stack</h3>';
                if (stack.frontend.length) html += '<div class="stack-row"><b>Frontend:</b> ' + esc(stack.frontend[0].name) + '</div>';
                if (stack.backend.length) html += '<div class="stack-row"><b>Backend:</b> ' + esc(stack.backend[0].name) + '</div>';
                if (stack.database.length) html += '<div class="stack-row"><b>Database:</b> ' + esc(stack.database[0].name) + '</div>';
            }

            container.innerHTML = html;
        }

        window.addEventListener('load', function () {
            document.getElementById('app').addEventListener('click', onAppClick_);
            init();
        });
    

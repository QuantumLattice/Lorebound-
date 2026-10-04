(() => {
  const STORAGE_KEY = 'lorebound.characters.v1';
  const DRAFT_KEY = 'lorebound.draft.v1';

  const state = {
    view: 'home',
    step: 0,
    draft: freshDraft(),
    editingId: null
  };

  const steps = [
    { key: 'world', label: 'World' },
    { key: 'identity', label: 'Identity' },
    { key: 'origin', label: 'Origin' },
    { key: 'personality', label: 'Personality' },
    { key: 'bonds', label: 'Bonds' },
    { key: 'turning', label: 'Turning point' },
    { key: 'review', label: 'Backstory' }
  ];

  const app = document.getElementById('app');
  const homeTemplate = document.getElementById('homeTemplate');
  const builderTemplate = document.getElementById('builderTemplate');
  const libraryTemplate = document.getElementById('libraryTemplate');
  const libraryCount = document.getElementById('libraryCount');
  const installBtn = document.getElementById('installBtn');
  let deferredInstallPrompt = null;

  document.getElementById('homeBtn').addEventListener('click', () => navigate('home'));
  document.getElementById('libraryBtn').addEventListener('click', () => navigate('library'));
  document.getElementById('newCharacterBtn').addEventListener('click', startNew);
  installBtn?.addEventListener('click', requestInstall);
  window.addEventListener('beforeinstallprompt', (event) => { event.preventDefault(); deferredInstallPrompt = event; installBtn.style.display = ''; });
  window.addEventListener('appinstalled', () => { deferredInstallPrompt = null; markInstalled(); });
  window.addEventListener('online', updateOfflineStatus);
  window.addEventListener('offline', updateOfflineStatus);

  app.addEventListener('click', handleAppClick);
  app.addEventListener('input', syncDraftFromForm);
  app.addEventListener('change', syncDraftFromForm);

  restoreDraft();
  updateLibraryCount();
  render();
  addInstallDialog();
  updateOfflineStatus();
  if (isStandalone()) markInstalled();

  function freshDraft() {
    return {
      id: '',
      createdAt: '',
      updatedAt: '',
      genre: 'Fantasy',
      tone: 'Heroic',
      world: '',
      name: '',
      ancestry: '',
      role: '',
      age: '',
      birthplace: '',
      upbringing: 'Humble',
      family: '',
      earlyLife: '',
      traits: ['Loyal'],
      flaw: '',
      fear: '',
      desire: '',
      ally: '',
      rival: '',
      mentor: '',
      loss: '',
      turningPoint: '',
      secret: '',
      presentGoal: '',
      story: ''
    };
  }

  function getCharacters() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch { return []; }
  }

  function setCharacters(chars) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chars));
    updateLibraryCount();
  }

  function updateLibraryCount() {
    libraryCount.textContent = getCharacters().length;
  }

  function persistDraft() {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ draft: state.draft, step: state.step, editingId: state.editingId }));
  }

  function restoreDraft() {
    try {
      const stored = JSON.parse(localStorage.getItem(DRAFT_KEY));
      if (stored?.draft) {
        state.draft = { ...freshDraft(), ...stored.draft };
        state.step = Math.min(Number(stored.step) || 0, steps.length - 1);
        state.editingId = stored.editingId || null;
      }
    } catch {}
  }

  function clearDraft() { localStorage.removeItem(DRAFT_KEY); }

  function navigate(view) {
    state.view = view;
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function startNew() {
    state.draft = freshDraft();
    state.step = 0;
    state.editingId = null;
    persistDraft();
    navigate('builder');
  }

  function editCharacter(id) {
    const char = getCharacters().find(c => c.id === id);
    if (!char) return;
    state.draft = { ...freshDraft(), ...char };
    state.editingId = id;
    state.step = 0;
    persistDraft();
    navigate('builder');
  }

  function render() {
    app.innerHTML = '';
    if (state.view === 'home') renderHome();
    if (state.view === 'builder') renderBuilder();
    if (state.view === 'library') renderLibrary();
  }

  function renderHome() {
    app.append(homeTemplate.content.cloneNode(true));
    const chars = getCharacters();
    if (chars.length) {
      const recent = chars.slice().sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];
      const section = document.createElement('section');
      section.className = 'section-gap';
      section.innerHTML = `
        <p class="eyebrow">CONTINUE YOUR ARCHIVE</p>
        <div class="library-card" style="max-width:560px">
          <span class="genre">${escapeHtml(recent.genre || 'Character')}</span>
          <h3>${escapeHtml(recent.name || 'Untitled character')}</h3>
          <p class="summary">${escapeHtml(recent.story || 'Continue building this character.')}</p>
          <div class="card-actions">
            <button class="primary-btn" data-action="view" data-id="${recent.id}">Open character</button>
            <button class="secondary-btn" data-action="edit" data-id="${recent.id}">Edit</button>
          </div>
        </div>`;
      app.append(section);
    }
  }

  function renderBuilder() {
    app.append(builderTemplate.content.cloneNode(true));
    renderStepNav();
    renderStepContent();
  }

  function renderStepNav() {
    const nav = document.getElementById('stepNav');
    document.getElementById('draftNameSidebar').textContent = state.draft.name || 'Untitled character';
    nav.innerHTML = steps.map((s, i) => `
      <button class="step-pill ${i === state.step ? 'active' : ''} ${i < state.step ? 'complete' : ''}" data-step="${i}">
        <span class="num">${i < state.step ? '✓' : String(i + 1).padStart(2,'0')}</span>
        <span class="label">${s.label}</span>
      </button>`).join('');
    document.getElementById('progressBar').style.width = `${((state.step + 1) / steps.length) * 100}%`;
  }

  function renderStepContent() {
    const container = document.getElementById('stepContent');
    const d = state.draft;
    const html = [
      worldStep,
      identityStep,
      originStep,
      personalityStep,
      bondsStep,
      turningStep,
      reviewStep
    ][state.step](d);
    container.innerHTML = html;

    const backBtn = document.getElementById('backBtn');
    const nextBtn = document.getElementById('nextBtn');
    backBtn.style.visibility = state.step === 0 ? 'hidden' : 'visible';
    nextBtn.textContent = state.step === steps.length - 1 ? 'Save character' : 'Continue';
    backBtn.onclick = () => goStep(state.step - 1);
    nextBtn.onclick = () => {
      syncDraftFromForm();
      if (!validateStep()) return;
      if (state.step === steps.length - 1) saveCharacter();
      else goStep(state.step + 1);
    };
  }

  function goStep(index) {
    syncDraftFromForm();
    state.step = Math.max(0, Math.min(index, steps.length - 1));
    if (state.step === steps.length - 1) state.draft.story = composeStory(state.draft);
    persistDraft();
    renderBuilder();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function syncDraftFromForm(event) {
    if (state.view !== 'builder') return;
    const form = document.querySelector('[data-step-form]');
    if (!form) return;

    const data = new FormData(form);
    for (const [key, value] of data.entries()) {
      if (key === 'traits') continue;
      state.draft[key] = value;
    }
    if (form.querySelector('[name="traits"]')) {
      state.draft.traits = data.getAll('traits');
    }
    document.getElementById('draftNameSidebar')?.replaceChildren(document.createTextNode(state.draft.name || 'Untitled character'));
    if (event) persistDraft();
  }

  function validateStep() {
    if (state.step === 0 && !state.draft.genre) return warn('Choose a genre first.');
    if (state.step === 1 && !state.draft.name.trim()) return warn('Give your character a name.');
    if (state.step === 2 && !state.draft.birthplace.trim()) return warn('Add a birthplace or place of origin.');
    if (state.step === 3 && !state.draft.traits.length) return warn('Choose at least one personality trait.');
    if (state.step === 5 && !state.draft.turningPoint.trim()) return warn('Describe the event that changed their life.');
    return true;
  }

  function warn(message) { toast(message); return false; }

  function saveCharacter() {
    state.draft.story = composeStory(state.draft);
    const now = new Date().toISOString();
    const chars = getCharacters();
    let saved;

    if (state.editingId) {
      const index = chars.findIndex(c => c.id === state.editingId);
      saved = { ...state.draft, id: state.editingId, createdAt: chars[index]?.createdAt || now, updatedAt: now };
      if (index >= 0) chars[index] = saved; else chars.unshift(saved);
    } else {
      saved = { ...state.draft, id: cryptoRandomId(), createdAt: now, updatedAt: now };
      chars.unshift(saved);
    }

    setCharacters(chars);
    state.draft = saved;
    state.editingId = saved.id;
    clearDraft();
    toast('Character saved to your local library.');
    navigate('library');
  }

  function deleteCharacter(id) {
    const chars = getCharacters();
    const char = chars.find(c => c.id === id);
    if (!char) return;
    if (!confirm(`Delete ${char.name || 'this character'}? This cannot be undone.`)) return;
    setCharacters(chars.filter(c => c.id !== id));
    renderLibrary();
    toast('Character deleted.');
  }

  function viewCharacter(id) {
    const char = getCharacters().find(c => c.id === id);
    if (!char) return;
    app.innerHTML = `
      <section class="page-heading">
        <div><p class="eyebrow">${escapeHtml((char.genre || 'Character').toUpperCase())}</p><h1>${escapeHtml(char.name || 'Untitled')}</h1><p>${escapeHtml([char.ancestry, char.role].filter(Boolean).join(' • '))}</p></div>
        <div class="heading-actions"><button class="secondary-btn" data-action="library">Back to library</button><button class="secondary-btn" data-action="download-text" data-id="${char.id}">Export text</button><button class="primary-btn" data-action="edit" data-id="${char.id}">Edit character</button></div>
      </section>
      <section class="review-grid">
        <div class="review-meta">
          ${meta('Tone', char.tone)}${meta('World', char.world)}${meta('Origin', char.birthplace)}${meta('Upbringing', char.upbringing)}${meta('Traits', (char.traits || []).join(', '))}${meta('Goal', char.presentGoal)}
        </div>
        <article class="story-panel"><p class="eyebrow">BACKSTORY</p><h2>${escapeHtml(char.name || 'Untitled')}</h2><div class="story-text">${escapeHtml(char.story)}</div></article>
      </section>`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderLibrary() {
    app.innerHTML = '';
    app.append(libraryTemplate.content.cloneNode(true));
    const grid = document.getElementById('libraryGrid');
    const chars = getCharacters().slice().sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    if (!chars.length) {
      grid.innerHTML = `<div class="empty-state"><h3>No characters yet</h3><p>Your archive is empty. Create your first Lorebound character.</p><button class="primary-btn" data-action="start">Create a character</button></div>`;
    } else {
      grid.innerHTML = chars.map(c => `
        <article class="library-card">
          <span class="genre">${escapeHtml(c.genre || 'Character')}</span>
          <h3>${escapeHtml(c.name || 'Untitled')}</h3>
          <p class="summary">${escapeHtml(c.story || '')}</p>
          <div class="card-actions">
            <button class="primary-btn" data-action="view" data-id="${c.id}">Open</button>
            <button class="secondary-btn" data-action="edit" data-id="${c.id}">Edit</button>
            <button class="text-btn danger-text" data-action="delete" data-id="${c.id}">Delete</button>
          </div>
        </article>`).join('');
    }

    document.getElementById('exportLibraryBtn').onclick = exportLibrary;
    document.getElementById('importInput').onchange = importLibrary;
  }

  function handleAppClick(e) {
    const actionEl = e.target.closest('[data-action]');
    if (actionEl) {
      const { action, id } = actionEl.dataset;
      if (action === 'start') startNew();
      if (action === 'library') navigate('library');
      if (action === 'discard') {
        if (confirm('Discard this draft?')) {
          clearDraft();
          state.draft = freshDraft();
          state.step = 0;
          state.editingId = null;
          navigate('home');
        }
      }
      if (action === 'view') viewCharacter(id);
      if (action === 'edit') editCharacter(id);
      if (action === 'delete') deleteCharacter(id);
      if (action === 'download-text') downloadCharacterText(id);
      if (action === 'regenerate') {
        syncDraftFromForm();
        state.draft.story = composeStory(state.draft, true);
        persistDraft();
        renderStepContent();
      }
      if (action === 'copy-story') copyStory();
      if (action === 'install-help') openInstallHelp();
      return;
    }
    const stepEl = e.target.closest('[data-step]');
    if (stepEl) goStep(Number(stepEl.dataset.step));
  }

  function worldStep(d) {
    return `
      <form data-step-form>
        ${header('01 — World', 'Choose the kind of setting your character belongs to.', 'This changes the language and atmosphere of the final backstory.')}
        <div class="choice-grid">
          ${choice('genre','Fantasy','Kingdoms, magic, ancient orders and forgotten ruins.',d.genre)}
          ${choice('genre','Science Fiction','Distant worlds, megacities, starships and strange technology.',d.genre)}
          ${choice('genre','Modern','A grounded contemporary setting with room for crime, drama or adventure.',d.genre)}
          ${choice('genre','Horror','Secrets, dread, dangerous places and things better left unknown.',d.genre)}
        </div>
        <div class="field-grid section-gap">
          ${selectField('tone','Story tone',['Heroic','Dark','Tragic','Hopeful','Mysterious','Gritty'],d.tone)}
          ${textField('world','World / campaign name',d.world,'e.g. The Shattered Crown, Mars Colony 9')}
        </div>
      </form>`;
  }

  function identityStep(d) {
    return `
      <form data-step-form>
        ${header('02 — Identity', 'Who are they when the story begins?', 'Give Lorebound enough detail to anchor the character in the world.')}
        <div class="field-grid">
          ${textField('name','Character name',d.name,'e.g. Elara Voss')}
          ${textField('ancestry','Ancestry / species',d.ancestry,'e.g. Human, Elf, Android')}
          ${textField('role','Role / class / occupation',d.role,'e.g. Ranger, Smuggler, Detective')}
          ${textField('age','Age',d.age,'e.g. 27')}
        </div>
      </form>`;
  }

  function originStep(d) {
    return `
      <form data-step-form>
        ${header('03 — Origin', 'Decide what shaped their earliest years.', 'A strong origin gives the character something to carry into every later decision.')}
        <div class="field-grid">
          ${textField('birthplace','Birthplace / place of origin',d.birthplace,'e.g. Greyhaven, Orbital Habitat Kestrel')}
          ${selectField('upbringing','Upbringing',['Humble','Privileged','Isolated','Militarised','Nomadic','Criminal','Scholarly','Religious'],d.upbringing)}
          ${textareaField('family','Family background',d.family,'Who raised them? What was home like?')}
          ${textareaField('earlyLife','Important childhood memory',d.earlyLife,'A moment, lesson, promise or mistake that stayed with them.')}
        </div>
      </form>`;
  }

  function personalityStep(d) {
    const traits = ['Loyal','Ambitious','Compassionate','Cynical','Curious','Reckless','Disciplined','Proud','Cautious','Idealistic','Vengeful','Charming'];
    return `
      <form data-step-form>
        ${header('04 — Personality', 'Give them strengths, contradictions and something to fear.', 'Choose as many traits as fit. Flaws and desires make the backstory feel human.')}
        <label class="field-label">Core traits</label>
        <div class="tag-options section-gap" style="margin-top:10px">${traits.map(t => tagChoice('traits',t,(d.traits||[]).includes(t))).join('')}</div>
        <div class="field-grid section-gap">
          ${textField('flaw','Greatest flaw',d.flaw,'e.g. Never asks for help')}
          ${textField('fear','Deepest fear',d.fear,'e.g. Becoming like their father')}
          ${textareaField('desire','What do they truly want?',d.desire,'What would they chase even if nobody else understood?')}
        </div>
      </form>`;
  }

  function bondsStep(d) {
    return `
      <form data-step-form>
        ${header('05 — Bonds', 'Every memorable character is tied to someone.', 'Names are optional. Describe the relationship if you do not have a name yet.')}
        <div class="field-grid">
          ${textField('ally','Closest ally',d.ally,'e.g. Mara, an old squadmate')}
          ${textField('rival','Rival / enemy',d.rival,'e.g. Captain Roen')}
          ${textField('mentor','Mentor / influence',d.mentor,'e.g. The archivist who taught them')}
          ${textField('loss','Someone or something they lost',d.loss,'e.g. Their younger brother')}
        </div>
      </form>`;
  }

  function turningStep(d) {
    return `
      <form data-step-form>
        ${header('06 — Turning point', 'What event made their old life impossible?', 'This becomes the hinge of the final backstory and explains why the character is adventuring now.')}
        <div class="field-grid">
          ${textareaField('turningPoint','The event that changed everything',d.turningPoint,'What happened, and what did the character do about it?')}
          ${textareaField('secret','A secret they carry',d.secret,'Optional: a truth they hide from allies, enemies or themselves.')}
          ${textareaField('presentGoal','What are they pursuing now?',d.presentGoal,'Revenge, redemption, discovery, wealth, duty, escape…')}
        </div>
      </form>`;
  }

  function reviewStep(d) {
    const story = d.story || composeStory(d);
    return `
      <form data-step-form>
        ${header('07 — Backstory', 'Your character is ready for the table.', 'Lorebound assembled this locally from your choices. Nothing was sent to an external service.')}
        <div class="review-grid">
          <div class="review-meta">
            ${meta('Genre', d.genre)}${meta('Tone', d.tone)}${meta('Origin', d.birthplace)}${meta('Role', d.role)}${meta('Traits', (d.traits||[]).join(', '))}${meta('Goal', d.presentGoal)}
          </div>
          <article class="story-panel">
            <p class="eyebrow">GENERATED BACKSTORY</p>
            <h2>${escapeHtml(d.name || 'Untitled character')}</h2>
            <div class="story-text">${escapeHtml(story)}</div>
            <div class="story-actions"><button type="button" class="secondary-btn" data-action="regenerate">Regenerate wording</button><button type="button" class="secondary-btn" data-action="copy-story">Copy story</button></div>
          </article>
        </div>
      </form>`;
  }

  function composeStory(d, alternate = false) {
    const name = clean(d.name, 'The character');
    const genre = d.genre || 'Fantasy';
    const origin = clean(d.birthplace, 'an unremarkable corner of the world');
    const role = d.role ? ` who would eventually become ${article(d.role)} ${d.role}` : '';
    const ancestry = d.ancestry ? `${d.ancestry} ` : '';
    const toneOpeners = {
      Heroic: 'Long before anyone had reason to remember the name',
      Dark: 'There are names spoken softly in places where the light does not reach, and one of them is',
      Tragic: 'Before loss gave weight to every choice, there was simply',
      Hopeful: 'In a world that offered plenty of reasons to surrender, there remained',
      Mysterious: 'No two accounts agree on the early life of',
      Gritty: 'Nothing about survival came cheaply to'
    };
    const settingFlavor = {
      Fantasy: 'old roads, hard winters and stories older than the maps',
      'Science Fiction': 'sealed habitats, distant signals and machines that never quite sleep',
      Modern: 'crowded streets, private ambitions and consequences that travel fast',
      Horror: 'quiet rooms, missing answers and the sense that some doors should remain closed'
    };
    const traits = (d.traits || []).filter(Boolean);
    const traitPhrase = traits.length ? traits.slice(0,3).join(', ').toLowerCase() : 'difficult to read';
    const opener = alternate
      ? `${name} came from ${origin}, a place defined by ${settingFlavor[genre] || 'uncertain fortunes'}.`
      : `${toneOpeners[d.tone] || toneOpeners.Heroic} ${name}. Born in ${origin}, the ${ancestry.toLowerCase()}child grew up amid ${settingFlavor[genre] || 'uncertain fortunes'}${role}.`;

    const parts = [opener];

    const familyBits = [];
    if (d.upbringing) familyBits.push(`Their upbringing was ${d.upbringing.toLowerCase()}`);
    if (d.family) familyBits.push(clean(d.family));
    if (familyBits.length) parts.push(`${familyBits.join('. ')}.`);
    if (d.earlyLife) parts.push(`One memory endured above the rest: ${sentence(d.earlyLife)}`);

    parts.push(`${name} became known for being ${traitPhrase}${d.flaw ? `, though ${clean(d.flaw).toLowerCase()} often complicated even the best intentions` : ''}.`);
    if (d.fear || d.desire) {
      const inner = [];
      if (d.fear) inner.push(`Beneath that exterior lived a fear of ${clean(d.fear).toLowerCase()}`);
      if (d.desire) inner.push(`and a private desire ${desirePhrase(d.desire)}`);
      parts.push(`${inner.join(' ')}.`);
    }

    const bonds = [];
    if (d.ally) bonds.push(`${clean(d.ally)} stood closest to them`);
    if (d.mentor) bonds.push(`${clean(d.mentor)} left a lasting influence`);
    if (d.rival) bonds.push(`${clean(d.rival)} became a source of conflict they could never fully ignore`);
    if (bonds.length) parts.push(`${bonds.join('; ')}.`);
    if (d.loss) parts.push(`The loss of ${clean(d.loss)} left a mark that never entirely healed.`);

    if (d.turningPoint) parts.push(`Then came the moment that divided their life into before and after: ${sentence(d.turningPoint)}`);
    if (d.secret) parts.push(`Even now, ${name} keeps one truth carefully buried: ${sentence(d.secret)}`);

    if (d.presentGoal) {
      parts.push(`Now ${name} moves forward with a clear purpose: ${sentence(d.presentGoal)} Whatever waits ahead, the person who left ${origin} behind is no longer the person who returns.`);
    } else {
      parts.push(`Whatever waits ahead, ${name} carries the past like a second shadow — not as a chain, but as the reason every choice still matters.`);
    }

    return parts.join('\n\n');
  }

  function header(kicker, title, text) {
    return `<div class="step-header"><p class="eyebrow">${kicker}</p><h1>${title}</h1><p>${text}</p></div>`;
  }
  function choice(name, value, desc, current) {
    return `<div class="choice-card"><input id="${name}-${slug(value)}" type="radio" name="${name}" value="${escapeAttr(value)}" ${current===value?'checked':''}><label for="${name}-${slug(value)}"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(desc)}</span></label></div>`;
  }
  function tagChoice(name, value, checked) {
    return `<span class="tag-choice"><input id="${name}-${slug(value)}" type="checkbox" name="${name}" value="${escapeAttr(value)}" ${checked?'checked':''}><label for="${name}-${slug(value)}">${escapeHtml(value)}</label></span>`;
  }
  function textField(name, label, value, placeholder='') {
    return `<div class="field"><label class="field-label" for="${name}">${label}</label><input id="${name}" name="${name}" type="text" value="${escapeAttr(value||'')}" placeholder="${escapeAttr(placeholder)}"></div>`;
  }
  function textareaField(name, label, value, placeholder='') {
    return `<div class="field"><label class="field-label" for="${name}">${label}</label><textarea id="${name}" name="${name}" placeholder="${escapeAttr(placeholder)}">${escapeHtml(value||'')}</textarea></div>`;
  }
  function selectField(name, label, options, current) {
    return `<div class="field"><label class="field-label" for="${name}">${label}</label><select id="${name}" name="${name}">${options.map(o=>`<option value="${escapeAttr(o)}" ${current===o?'selected':''}>${escapeHtml(o)}</option>`).join('')}</select></div>`;
  }
  function meta(label, value) {
    if (!value) return '';
    return `<div class="meta-row"><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong></div>`;
  }

  function exportLibrary() {
    const payload = JSON.stringify({ app: 'Lorebound', version: 1, exportedAt: new Date().toISOString(), characters: getCharacters() }, null, 2);
    downloadBlob(payload, 'lorebound-library.json', 'application/json');
  }

  function importLibrary(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const incoming = Array.isArray(parsed) ? parsed : parsed.characters;
        if (!Array.isArray(incoming)) throw new Error('Invalid file');
        const existing = getCharacters();
        const byId = new Map(existing.map(c => [c.id, c]));
        incoming.forEach(c => {
          const id = c.id || cryptoRandomId();
          byId.set(id, { ...freshDraft(), ...c, id, updatedAt: c.updatedAt || new Date().toISOString(), createdAt: c.createdAt || new Date().toISOString() });
        });
        setCharacters([...byId.values()]);
        renderLibrary();
        toast(`Imported ${incoming.length} character${incoming.length===1?'':'s'}.`);
      } catch { toast('That file is not a valid Lorebound export.'); }
      event.target.value = '';
    };
    reader.readAsText(file);
  }

  function downloadCharacterText(id) {
    const c = getCharacters().find(x => x.id === id);
    if (!c) return;
    const text = `${c.name || 'Untitled'}\n${[c.ancestry, c.role, c.genre].filter(Boolean).join(' • ')}\n\n${c.story || ''}`;
    downloadBlob(text, `${slug(c.name || 'lorebound-character')}.txt`, 'text/plain');
  }

  function downloadBlob(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  async function copyStory() {
    try { await navigator.clipboard.writeText(state.draft.story || composeStory(state.draft)); toast('Backstory copied.'); }
    catch { toast('Copy failed. Select the text manually.'); }
  }

  function toast(message) {
    document.querySelector('.toast')?.remove();
    const el = document.createElement('div');
    el.className = 'toast'; el.textContent = message; document.body.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }


  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
  }

  function addInstallDialog() {
    if (document.getElementById('installDialog')) return;
    const dialog = document.createElement('dialog');
    dialog.id = 'installDialog';
    dialog.className = 'install-dialog';
    dialog.innerHTML = `
      <div class="install-dialog-inner">
        <p class="eyebrow">INSTALL LOREBOUND</p>
        <h2>Add it to your Home Screen</h2>
        <ol>
          <li>Open this Lorebound site in <strong>Safari</strong>.</li>
          <li>Tap the <strong>Share</strong> button.</li>
          <li>Choose <strong>Add to Home Screen</strong>.</li>
          <li>Tap <strong>Add</strong>. Lorebound will launch like an app.</li>
        </ol>
        <p class="help">The first visit needs an internet connection so the app files can be cached. Character data stays in this browser on this device unless you export it.</p>
        <div class="dialog-actions"><button class="primary-btn" type="button" id="closeInstallDialog">Done</button></div>
      </div>`;
    document.body.appendChild(dialog);
    document.getElementById('closeInstallDialog').onclick = () => dialog.close();
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  }

  async function requestInstall() {
    if (isStandalone()) return toast('Lorebound is already installed.');
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice.catch(() => null);
      deferredInstallPrompt = null;
      return;
    }
    openInstallHelp();
  }

  function openInstallHelp() {
    const dialog = document.getElementById('installDialog');
    if (!dialog) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else alert(isIOS() ? 'In Safari: tap Share, choose Add to Home Screen, then tap Add.' : 'Use your browser menu and choose Install app or Add to Home Screen.');
  }

  function markInstalled() {
    document.getElementById('installCard')?.classList.add('is-installed');
    if (installBtn) installBtn.style.display = 'none';
  }

  function updateOfflineStatus() {
    let badge = document.getElementById('offlineBadge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'offlineBadge';
      badge.className = 'offline-badge';
      badge.textContent = 'Offline — Lorebound is still available';
      document.body.appendChild(badge);
    }
    badge.classList.toggle('visible', !navigator.onLine);
  }

  function cryptoRandomId() {
    if (crypto?.randomUUID) return crypto.randomUUID();
    return `lb-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
  function article(word) { return /^[aeiou]/i.test(String(word).trim()) ? 'an' : 'a'; }
  function clean(v, fallback='') { return String(v || fallback).trim().replace(/\s+/g,' '); }
  function sentence(v) { const s = clean(v); return !s ? '' : /[.!?]$/.test(s) ? s : `${s}.`; }
  function desirePhrase(v) { const s = clean(v); return /^(to|for|of|that)\b/i.test(s) ? s : `to ${s.charAt(0).toLowerCase()+s.slice(1)}`; }
  function slug(v) { return String(v).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }
  function escapeHtml(v) { return String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function escapeAttr(v) { return escapeHtml(v).replace(/`/g,'&#96;'); }
})();

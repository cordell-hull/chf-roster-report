import { generatePDF, generateFilename, downloadPDF, importReportFromPDF } from './lib/pdf.js';
import { APP_VERSION } from './config/version.js';

const TOTAL_STEPS = 5;
const STORAGE_KEY = 'chf-roster-data';
const SHARED_SCHOOL_KEY = 'chf-school-info';
const RECRUITMENT_KEY = 'chf-recruitment-data';

// ========================================
// Application State
// ========================================

function _emptyTeacher() {
  return {
    firstName: '', lastName: '', email: '',
    gender: '', programYear: '',
    birthDate: '', birthCity: '', birthCountry: '',
    countryOfResidence: '', nationality: '',
    level: '', state: '', yearlySalary: '',
    tenureStart: '', tenureEnd: ''
  };
}

function _emptyRelative() {
  return {
    lastName: '', firstName: '', middleName: '',
    teacherIndex: -1, relationship: '',
    birthDate: '', birthCity: '', birthCountry: '',
    countryOfResidence: '', nationality: ''
  };
}

const report = {
  date: '',
  schoolYear: '',
  schoolName: '',
  contactFirstName: '',
  contactLastName: '',
  contactEmail: '',
  teachers: [],
  relatives: [],
  signature: { imageDataUrl: null, signerName: '', signerTitle: '' }
};

let currentStep = 1;
let editingTeacherIndex = -1;
let wasAddingTeacher = false;
let editingRelativeIndex = -1;
let wasAddingRelative = false;

// ========================================
// Storage
// ========================================

function _saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(report));
    localStorage.setItem(SHARED_SCHOOL_KEY, JSON.stringify({
      schoolName: report.schoolName,
      contactFirstName: report.contactFirstName,
      contactLastName: report.contactLastName,
      contactEmail: report.contactEmail
    }));
  } catch {}
}

function _loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw);
    if (!saved || !saved.schoolName) return false;
    Object.assign(report, {
      date: saved.date || report.date,
      schoolYear: saved.schoolYear || '',
      schoolName: saved.schoolName || '',
      contactFirstName: saved.contactFirstName || '',
      contactLastName: saved.contactLastName || '',
      contactEmail: saved.contactEmail || '',
      teachers: saved.teachers || [],
      relatives: saved.relatives || [],
      signature: saved.signature || { imageDataUrl: null, signerName: '', signerTitle: '' }
    });
    return true;
  } catch { return false; }
}

function _clearStorage() { try { localStorage.removeItem(STORAGE_KEY); } catch {} }

function _hasStoredData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return !!(saved && saved.schoolName);
  } catch { return false; }
}

// ========================================
// Landing Screen
// ========================================

function initLanding() {
  document.getElementById('continueBtn').addEventListener('click', _continueExisting);
  document.getElementById('startNewBtn').addEventListener('click', _confirmStartNew);
  document.getElementById('importPdfInput').addEventListener('change', _handlePdfImport);

  if (_hasStoredData()) {
    _showLanding(true);
  } else {
    _showLanding(false);
  }
}

function _showLanding(hasData) {
  if (hasData) {
    let saved;
    try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); }
    catch { _showLanding(false); return; }
    if (!saved || !saved.schoolName) { _showLanding(false); return; }

    document.getElementById('landingSchoolName').textContent = saved.schoolName;
    const tc = (saved.teachers || []).length;
    document.getElementById('landingInfo').textContent =
      `${tc} teacher${tc !== 1 ? 's' : ''} in this roster`;
    document.getElementById('continueBtn').style.display = '';
    document.getElementById('startNewBtn').textContent = 'Start New Roster';
  } else {
    document.getElementById('landingSchoolName').textContent = 'Teacher Roster';
    document.getElementById('landingInfo').textContent = 'No saved roster found.';
    document.getElementById('continueBtn').style.display = 'none';
    document.getElementById('startNewBtn').textContent = 'Start New Roster';
  }

  document.getElementById('landingScreen').style.display = 'flex';
  document.getElementById('wizardProgress').style.display = 'none';
  document.getElementById('wizardContent').style.display = 'none';
  document.getElementById('wizardNavigation').style.display = 'none';
}

function _continueExisting() {
  _loadFromStorage();
  _restoreAllFields();
  _showWizard();
}

function _confirmStartNew() {
  if (_hasStoredData()) {
    if (!confirm('This will delete all saved roster data. Are you sure?')) return;
    _clearStorage();
  }
  _startFresh();
}

function _startFresh() {
  report.schoolYear = '';
  report.schoolName = '';
  report.contactFirstName = '';
  report.contactLastName = '';
  report.contactEmail = '';
  report.teachers = [];
  report.relatives = [];
  report.signature = { imageDataUrl: null, signerName: '', signerTitle: '' };
  report.date = new Date().toISOString().split('T')[0];

  try {
    const shared = JSON.parse(localStorage.getItem(SHARED_SCHOOL_KEY));
    if (shared && shared.schoolName) {
      report.schoolName = shared.schoolName;
      report.contactFirstName = shared.contactFirstName || '';
      report.contactLastName = shared.contactLastName || '';
      report.contactEmail = shared.contactEmail || '';
    }
  } catch {}

  _restoreAllFields();
  _showWizard();
}

async function _handlePdfImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  const errorEl = document.getElementById('importError');
  errorEl.textContent = '';

  try {
    const data = await importReportFromPDF(file);
    if (!data) {
      errorEl.textContent = 'Could not read roster data from this PDF. Only PDFs generated by this app can be imported.';
      return;
    }
    if (_hasStoredData()) {
      if (!confirm('Importing will replace all current data. Continue?')) return;
    }
    Object.assign(report, data);
    report.signature = { imageDataUrl: null, signerName: '', signerTitle: '' };
    _saveToStorage();
    _restoreAllFields();
    _showWizard();
  } catch {
    errorEl.textContent = 'Failed to read PDF file.';
  }
  e.target.value = '';
}

function _showWizard() {
  document.getElementById('landingScreen').style.display = 'none';
  document.getElementById('wizardProgress').style.display = '';
  document.getElementById('wizardContent').style.display = '';
  document.getElementById('wizardNavigation').style.display = '';
  currentStep = 1;
  updateWizardUI();
  updateHeaderDisplay();
}

function _restoreAllFields() {
  document.getElementById('schoolName').value = report.schoolName;
  document.getElementById('schoolYear').value = report.schoolYear;
  document.getElementById('contactFirstName').value = report.contactFirstName;
  document.getElementById('contactLastName').value = report.contactLastName;
  document.getElementById('contactEmail').value = report.contactEmail;
  document.getElementById('signerName').value = report.signature.signerName;
  document.getElementById('signerTitle').value = report.signature.signerTitle;
  if (report.signature.imageDataUrl) restoreSignatureCanvas(report.signature.imageDataUrl);
  updateHeaderDisplay();
}

// ========================================
// Initialization
// ========================================

document.addEventListener('DOMContentLoaded', () => {
  initNavigationButtons();
  initSchoolNameListener();
  initTeacherButtons();
  initRelativeButtons();
  initSignatureCanvas();

  document.getElementById('generatePdfBtn').addEventListener('click', generateReport);
  report.date = new Date().toISOString().split('T')[0];
  document.getElementById('appVersion').textContent = `v${APP_VERSION}`;

  initLanding();
  setInterval(() => { _syncCurrentStep(); _saveToStorage(); }, 30000);
  window.addEventListener('beforeunload', () => { _syncCurrentStep(); _saveToStorage(); });
});

function updateHeaderDisplay() {
  document.getElementById('schoolNameHeader').textContent = report.schoolName || '';
  document.getElementById('schoolYearDisplay').textContent =
    report.schoolYear ? `School Year ${report.schoolYear}` : '';
}

function initSchoolNameListener() {
  document.getElementById('schoolName').addEventListener('input', (e) => {
    report.schoolName = e.target.value.trim();
    updateHeaderDisplay();
  });
  document.getElementById('schoolYear').addEventListener('input', (e) => {
    report.schoolYear = e.target.value.trim();
    updateHeaderDisplay();
  });
}

// ========================================
// Teacher Table / Form
// ========================================

function initTeacherButtons() {
  document.getElementById('addTeacherBtn').addEventListener('click', () => openTeacherForm(-1));
  document.getElementById('saveTeacherBtn').addEventListener('click', saveTeacher);
  document.getElementById('cancelTeacherBtn').addEventListener('click', closeTeacherForm);
  document.getElementById('backToTeacherListBtn').addEventListener('click', closeTeacherForm);
  document.getElementById('importTeachersBtn').addEventListener('click', showImportModal);
  document.getElementById('confirmImportBtn').addEventListener('click', confirmImport);
  document.getElementById('cancelImportBtn').addEventListener('click', () => {
    document.getElementById('importModal').style.display = 'none';
  });
}

function _showTeacherTableView() {
  document.getElementById('teacherTableView').style.display = 'block';
  document.getElementById('teacherFormView').style.display = 'none';
  renderTeacherTable();
  _updateNav(true);
}

function _showTeacherFormView() {
  document.getElementById('teacherTableView').style.display = 'none';
  document.getElementById('teacherFormView').style.display = 'block';
  _updateNav(false);
}

function _updateNav(show) {
  document.getElementById('prevBtn').style.display = show ? '' : 'none';
  document.getElementById('nextBtn').style.display = show ? '' : 'none';
}

const TEACHER_FIELDS = [
  'teacherLastName', 'teacherFirstName', 'teacherEmail', 'teacherGender',
  'programYear', 'birthDate', 'birthCity', 'birthCountry',
  'countryOfResidence', 'nationality', 'teacherLevel', 'teacherState',
  'yearlySalary', 'tenureStart', 'tenureEnd'
];

const TEACHER_STATE_MAP = {
  teacherLastName: 'lastName', teacherFirstName: 'firstName', teacherEmail: 'email',
  teacherGender: 'gender', programYear: 'programYear', birthDate: 'birthDate',
  birthCity: 'birthCity', birthCountry: 'birthCountry', countryOfResidence: 'countryOfResidence',
  nationality: 'nationality', teacherLevel: 'level', teacherState: 'state',
  yearlySalary: 'yearlySalary', tenureStart: 'tenureStart', tenureEnd: 'tenureEnd'
};

function openTeacherForm(index) {
  editingTeacherIndex = index;
  wasAddingTeacher = (index === -1);

  const t = index === -1 ? _emptyTeacher() : report.teachers[index];
  document.getElementById('teacherFormTitle').textContent = index === -1 ? 'Add Teacher' : `Edit Teacher #${index + 1}`;

  for (const [domId, stateKey] of Object.entries(TEACHER_STATE_MAP)) {
    document.getElementById(domId).value = t[stateKey] || '';
  }
  document.querySelectorAll('#teacherFormView .field-error').forEach(el => { el.textContent = ''; });
  _showTeacherFormView();
}

function _readTeacherFromForm() {
  const t = _emptyTeacher();
  for (const [domId, stateKey] of Object.entries(TEACHER_STATE_MAP)) {
    t[stateKey] = document.getElementById(domId).value.trim();
  }
  return t;
}

function saveTeacher() {
  const t = _readTeacherFromForm();
  if (!_validateTeacherForm(t)) return;

  if (editingTeacherIndex === -1) {
    report.teachers.push(t);
  } else {
    report.teachers[editingTeacherIndex] = t;
  }
  wasAddingTeacher = false;
  _saveToStorage();
  closeTeacherForm();
}

function closeTeacherForm() {
  if (wasAddingTeacher && editingTeacherIndex >= 0) {
    report.teachers.splice(editingTeacherIndex, 1);
  }
  editingTeacherIndex = -1;
  wasAddingTeacher = false;
  _saveToStorage();
  _showTeacherTableView();
}

function deleteTeacher(index) {
  if (!confirm('Delete this teacher? This cannot be undone.')) return;
  // Remove relatives linked to this teacher and adjust indices
  report.relatives = report.relatives.filter(r => r.teacherIndex !== index);
  report.relatives.forEach(r => { if (r.teacherIndex > index) r.teacherIndex--; });
  report.teachers.splice(index, 1);
  _saveToStorage();
  renderTeacherTable();
}

function renderTeacherTable() {
  const container = document.getElementById('teacherTableContainer');
  if (report.teachers.length === 0) {
    container.innerHTML = '<p class="empty-state">No teachers added yet.</p>';
    return;
  }

  const rows = report.teachers.map((t, i) => `
    <tr>
      <td>${escapeHtml(t.lastName)}, ${escapeHtml(t.firstName)}</td>
      <td>${escapeHtml(t.email)}</td>
      <td>${escapeHtml(t.gender)}</td>
      <td>${escapeHtml(t.level)}</td>
      <td>${escapeHtml(t.yearlySalary)}</td>
      <td>${escapeHtml(t.tenureStart)}${t.tenureEnd ? ` to ${escapeHtml(t.tenureEnd)}` : ''}</td>
      <td class="table-actions">
        <button type="button" class="btn-secondary btn-sm" data-edit="${i}">Edit</button>
        <button type="button" class="btn-icon-only btn-remove-teacher" data-delete="${i}" title="Delete">✕</button>
      </td>
    </tr>
  `).join('');

  container.innerHTML = `
    <div class="review-table-wrapper">
      <table class="review-table teacher-mgmt-table">
        <thead><tr><th>Name</th><th>Email</th><th>M/F</th><th>Level</th><th>Salary</th><th>Tenure</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;

  container.querySelectorAll('[data-edit]').forEach(btn =>
    btn.addEventListener('click', () => openTeacherForm(parseInt(btn.dataset.edit))));
  container.querySelectorAll('[data-delete]').forEach(btn =>
    btn.addEventListener('click', () => deleteTeacher(parseInt(btn.dataset.delete))));
}

// ========================================
// Import from Recruitment
// ========================================

function showImportModal() {
  let recruitData;
  try {
    recruitData = JSON.parse(localStorage.getItem(RECRUITMENT_KEY));
  } catch {}

  if (!recruitData || !recruitData.teachers || recruitData.teachers.length === 0) {
    alert('No teachers found in your recruitment report. Please fill out the recruitment form first.');
    return;
  }

  const existingEmails = new Set(report.teachers.map(t => t.email.toLowerCase()));
  const available = recruitData.teachers.filter(t =>
    t.email && !existingEmails.has(t.email.toLowerCase())
  );

  if (available.length === 0) {
    alert('All teachers from the recruitment report have already been imported.');
    return;
  }

  const list = document.getElementById('importTeacherList');
  list.innerHTML = available.map((t, i) => `
    <label class="checkbox-item import-check">
      <input type="checkbox" value="${i}" checked>
      ${escapeHtml(t.firstName)} ${escapeHtml(t.lastName)} (${escapeHtml(t.email)})
    </label>
  `).join('');

  list._availableTeachers = available;
  document.getElementById('importModal').style.display = 'flex';
}

function confirmImport() {
  const list = document.getElementById('importTeacherList');
  const available = list._availableTeachers;
  const checked = Array.from(list.querySelectorAll('input:checked')).map(cb => parseInt(cb.value));

  for (const idx of checked) {
    const src = available[idx];
    const t = _emptyTeacher();
    t.firstName = src.firstName || '';
    t.lastName = src.lastName || '';
    t.email = src.email || '';
    t.birthCountry = src.interviewCountry || '';
    t.countryOfResidence = src.interviewCountry || '';
    report.teachers.push(t);
  }

  _saveToStorage();
  document.getElementById('importModal').style.display = 'none';
  renderTeacherTable();
}

// ========================================
// Relative Table / Form
// ========================================

function initRelativeButtons() {
  document.getElementById('addRelativeBtn').addEventListener('click', () => openRelativeForm(-1));
  document.getElementById('saveRelativeBtn').addEventListener('click', saveRelative);
  document.getElementById('cancelRelativeBtn').addEventListener('click', closeRelativeForm);
  document.getElementById('backToRelativeListBtn').addEventListener('click', closeRelativeForm);
}

function _showRelativeTableView() {
  document.getElementById('relativeTableView').style.display = 'block';
  document.getElementById('relativeFormView').style.display = 'none';
  renderRelativeTable();
  _updateNav(true);
}

function _showRelativeFormView() {
  document.getElementById('relativeTableView').style.display = 'none';
  document.getElementById('relativeFormView').style.display = 'block';
  _updateNav(false);
}

function _populateTeacherDropdown() {
  const select = document.getElementById('relativeTeacher');
  const current = select.value;
  select.innerHTML = '<option value="">Select teacher...</option>' +
    report.teachers.map((t, i) =>
      `<option value="${i}">${escapeHtml(t.firstName)} ${escapeHtml(t.lastName)}</option>`
    ).join('');
  select.value = current;
}

const RELATIVE_FIELDS = [
  'relativeLastName', 'relativeFirstName', 'relativeMiddleName',
  'relativeTeacher', 'relativeRelationship',
  'relativeBirthDate', 'relativeBirthCity', 'relativeBirthCountry',
  'relativeResidence', 'relativeNationality'
];

const RELATIVE_STATE_MAP = {
  relativeLastName: 'lastName', relativeFirstName: 'firstName', relativeMiddleName: 'middleName',
  relativeTeacher: 'teacherIndex', relativeRelationship: 'relationship',
  relativeBirthDate: 'birthDate', relativeBirthCity: 'birthCity',
  relativeBirthCountry: 'birthCountry', relativeResidence: 'countryOfResidence',
  relativeNationality: 'nationality'
};

function openRelativeForm(index) {
  editingRelativeIndex = index;
  wasAddingRelative = (index === -1);

  _populateTeacherDropdown();
  const r = index === -1 ? _emptyRelative() : report.relatives[index];
  document.getElementById('relativeFormTitle').textContent = index === -1 ? 'Add Relative' : 'Edit Relative';

  for (const [domId, stateKey] of Object.entries(RELATIVE_STATE_MAP)) {
    const val = stateKey === 'teacherIndex' ? (r.teacherIndex >= 0 ? r.teacherIndex.toString() : '') : (r[stateKey] || '');
    document.getElementById(domId).value = val;
  }
  document.querySelectorAll('#relativeFormView .field-error').forEach(el => { el.textContent = ''; });
  _showRelativeFormView();
}

function _readRelativeFromForm() {
  const r = _emptyRelative();
  for (const [domId, stateKey] of Object.entries(RELATIVE_STATE_MAP)) {
    const val = document.getElementById(domId).value.trim();
    r[stateKey] = stateKey === 'teacherIndex' ? (val === '' ? -1 : parseInt(val)) : val;
  }
  return r;
}

function saveRelative() {
  const r = _readRelativeFromForm();
  if (!_validateRelativeForm(r)) return;

  if (editingRelativeIndex === -1) {
    report.relatives.push(r);
  } else {
    report.relatives[editingRelativeIndex] = r;
  }
  wasAddingRelative = false;
  _saveToStorage();
  closeRelativeForm();
}

function closeRelativeForm() {
  if (wasAddingRelative && editingRelativeIndex >= 0) {
    report.relatives.splice(editingRelativeIndex, 1);
  }
  editingRelativeIndex = -1;
  wasAddingRelative = false;
  _saveToStorage();
  _showRelativeTableView();
}

function deleteRelative(index) {
  if (!confirm('Delete this relative?')) return;
  report.relatives.splice(index, 1);
  _saveToStorage();
  renderRelativeTable();
}

function _teacherNameForRelative(rel) {
  if (rel.teacherIndex >= 0 && rel.teacherIndex < report.teachers.length) {
    const t = report.teachers[rel.teacherIndex];
    return `${t.firstName} ${t.lastName}`;
  }
  return '—';
}

function renderRelativeTable() {
  const container = document.getElementById('relativeTableContainer');
  if (report.relatives.length === 0) {
    container.innerHTML = '<p class="empty-state">No relatives added. If no relatives need J-2 visas, click Next to continue.</p>';
    return;
  }

  const rows = report.relatives.map((r, i) => `
    <tr>
      <td>${escapeHtml(r.lastName)}, ${escapeHtml(r.firstName)}</td>
      <td>${escapeHtml(r.relationship)}</td>
      <td>${escapeHtml(_teacherNameForRelative(r))}</td>
      <td class="table-actions">
        <button type="button" class="btn-secondary btn-sm" data-edit="${i}">Edit</button>
        <button type="button" class="btn-icon-only btn-remove-teacher" data-delete="${i}" title="Delete">✕</button>
      </td>
    </tr>
  `).join('');

  container.innerHTML = `
    <div class="review-table-wrapper">
      <table class="review-table">
        <thead><tr><th>Name</th><th>Relationship</th><th>Teacher</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;

  container.querySelectorAll('[data-edit]').forEach(btn =>
    btn.addEventListener('click', () => openRelativeForm(parseInt(btn.dataset.edit))));
  container.querySelectorAll('[data-delete]').forEach(btn =>
    btn.addEventListener('click', () => deleteRelative(parseInt(btn.dataset.delete))));
}

// ========================================
// Signature Canvas
// ========================================

let isDrawing = false;
let signatureCtx = null;

function initSignatureCanvas() {
  const canvas = document.getElementById('signatureCanvas');
  signatureCtx = canvas.getContext('2d');
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width || 500;
  canvas.height = 200;
  signatureCtx.lineWidth = 2;
  signatureCtx.lineCap = 'round';
  signatureCtx.strokeStyle = '#000';

  canvas.addEventListener('mousedown', startDrawing);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDrawing);
  canvas.addEventListener('mouseleave', stopDrawing);
  canvas.addEventListener('touchstart', (e) => { e.preventDefault(); startDrawing(e.touches[0]); });
  canvas.addEventListener('touchmove', (e) => { e.preventDefault(); draw(e.touches[0]); });
  canvas.addEventListener('touchend', stopDrawing);
  document.getElementById('clearSignatureBtn').addEventListener('click', clearSignature);
}

function _getCanvasCoords(e) {
  const canvas = document.getElementById('signatureCanvas');
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (canvas.width / rect.width),
    y: (e.clientY - rect.top) * (canvas.height / rect.height)
  };
}

function startDrawing(e) { isDrawing = true; const { x, y } = _getCanvasCoords(e); signatureCtx.beginPath(); signatureCtx.moveTo(x, y); }
function draw(e) { if (!isDrawing) return; const { x, y } = _getCanvasCoords(e); signatureCtx.lineTo(x, y); signatureCtx.stroke(); }
function stopDrawing() { isDrawing = false; }

function clearSignature() {
  const canvas = document.getElementById('signatureCanvas');
  signatureCtx.clearRect(0, 0, canvas.width, canvas.height);
  report.signature.imageDataUrl = null;
}

function _isCanvasBlank() {
  const canvas = document.getElementById('signatureCanvas');
  const blank = document.createElement('canvas');
  blank.width = canvas.width;
  blank.height = canvas.height;
  return canvas.toDataURL() === blank.toDataURL();
}

function _captureSignature() {
  report.signature.imageDataUrl = _isCanvasBlank()
    ? null
    : document.getElementById('signatureCanvas').toDataURL('image/png');
}

function restoreSignatureCanvas(dataUrl) {
  const img = new Image();
  img.onload = () => {
    const canvas = document.getElementById('signatureCanvas');
    signatureCtx.clearRect(0, 0, canvas.width, canvas.height);
    signatureCtx.drawImage(img, 0, 0);
  };
  img.src = dataUrl;
}

// ========================================
// Wizard Navigation
// ========================================

function initNavigationButtons() {
  document.getElementById('prevBtn').addEventListener('click', goToPreviousStep);
  document.getElementById('nextBtn').addEventListener('click', goToNextStep);
  updateNavigationButtons();
}

function _syncCurrentStep() {
  if (currentStep === 1) {
    report.schoolName = document.getElementById('schoolName').value.trim();
    report.schoolYear = document.getElementById('schoolYear').value.trim();
    report.contactFirstName = document.getElementById('contactFirstName').value.trim();
    report.contactLastName = document.getElementById('contactLastName').value.trim();
    report.contactEmail = document.getElementById('contactEmail').value.trim();
  }
  if (currentStep === 4) {
    _captureSignature();
    report.signature.signerName = document.getElementById('signerName').value.trim();
    report.signature.signerTitle = document.getElementById('signerTitle').value.trim();
  }
}

function goToPreviousStep() {
  if (currentStep > 1) {
    _syncCurrentStep();
    _saveToStorage();
    currentStep--;
    updateWizardUI();
  }
}

function goToNextStep() {
  _syncCurrentStep();
  if (!validateCurrentStep()) return;
  _saveToStorage();

  if (currentStep < TOTAL_STEPS) {
    currentStep++;
    updateWizardUI();
    if (currentStep === TOTAL_STEPS) renderReview();
  }
}

function updateWizardUI() {
  document.querySelectorAll('.wizard-step').forEach((step, i) => {
    step.classList.toggle('active', i + 1 === currentStep);
  });
  document.querySelectorAll('.progress-step').forEach((step, i) => {
    const n = i + 1;
    step.classList.remove('active', 'completed');
    if (n === currentStep) step.classList.add('active');
    else if (n < currentStep) step.classList.add('completed');
  });
  updateNavigationButtons();
  if (currentStep === 2) _showTeacherTableView();
  if (currentStep === 3) _showRelativeTableView();
}

function updateNavigationButtons() {
  document.getElementById('prevBtn').style.visibility = currentStep > 1 ? 'visible' : 'hidden';
  if (currentStep === TOTAL_STEPS) {
    document.getElementById('nextBtn').style.visibility = 'hidden';
  } else {
    document.getElementById('nextBtn').style.visibility = 'visible';
    document.getElementById('nextBtn').textContent = currentStep === TOTAL_STEPS - 1 ? 'Review →' : 'Next →';
  }
}

// ========================================
// Validation
// ========================================

function validateCurrentStep() {
  switch (currentStep) {
    case 1: return _validateSchool();
    case 2: return _validateTeacherList();
    case 4: return _validateSignature();
    default: return true;
  }
}

function _validateSchool() {
  let v = true;
  if (!report.schoolName) { showError('schoolNameError', 'Required.'); v = false; } else clearError('schoolNameError');
  if (!report.schoolYear) { showError('schoolYearError', 'Required.'); v = false; } else clearError('schoolYearError');
  if (!report.contactFirstName) { showError('contactFirstNameError', 'Required.'); v = false; } else clearError('contactFirstNameError');
  if (!report.contactLastName) { showError('contactLastNameError', 'Required.'); v = false; } else clearError('contactLastNameError');
  if (!report.contactEmail) { showError('contactEmailError', 'Required.'); v = false; } else clearError('contactEmailError');
  return v;
}

function _validateTeacherList() {
  if (report.teachers.length === 0) {
    showError('teacherTableError', 'You must add at least one teacher.');
    return false;
  }
  clearError('teacherTableError');
  return true;
}

function _validateTeacherForm(t) {
  let v = true;
  const req = { teacherLastName: 'lastName', teacherFirstName: 'firstName', teacherEmail: 'email',
    teacherGender: 'gender', programYear: 'programYear', birthDate: 'birthDate',
    birthCity: 'birthCity', birthCountry: 'birthCountry', nationality: 'nationality',
    teacherLevel: 'level', teacherState: 'state', yearlySalary: 'yearlySalary',
    tenureStart: 'tenureStart', tenureEnd: 'tenureEnd' };

  for (const [domId, stateKey] of Object.entries(req)) {
    if (!t[stateKey]) { showError(domId + 'Error', 'Required.'); v = false; }
    else clearError(domId + 'Error');
  }
  return v;
}

function _validateRelativeForm(r) {
  let v = true;
  if (!r.lastName) { showError('relativeLastNameError', 'Required.'); v = false; } else clearError('relativeLastNameError');
  if (!r.firstName) { showError('relativeFirstNameError', 'Required.'); v = false; } else clearError('relativeFirstNameError');
  if (r.teacherIndex < 0) { showError('relativeTeacherError', 'Required.'); v = false; } else clearError('relativeTeacherError');
  if (!r.relationship) { showError('relativeRelationshipError', 'Required.'); v = false; } else clearError('relativeRelationshipError');
  return v;
}

function _validateSignature() {
  let v = true;
  if (!report.signature.imageDataUrl) { showError('signatureError', 'Required.'); v = false; } else clearError('signatureError');
  if (!report.signature.signerName) { showError('signerNameError', 'Required.'); v = false; } else clearError('signerNameError');
  if (!report.signature.signerTitle) { showError('signerTitleError', 'Required.'); v = false; } else clearError('signerTitleError');
  return v;
}

// ========================================
// Review
// ========================================

function renderReview() {
  _syncCurrentStep();
  const container = document.getElementById('reviewContainer');

  const teacherRows = report.teachers.map(t => `
    <tr>
      <td>${escapeHtml(t.lastName)}, ${escapeHtml(t.firstName)}</td>
      <td>${escapeHtml(t.email)}</td>
      <td>${escapeHtml(t.gender)}</td>
      <td>${escapeHtml(t.programYear)}</td>
      <td>${escapeHtml(t.birthDate)}</td>
      <td>${escapeHtml(t.birthCountry)}</td>
      <td>${escapeHtml(t.nationality)}</td>
      <td>${escapeHtml(t.level)}</td>
      <td>${escapeHtml(t.state)}</td>
      <td>${escapeHtml(t.yearlySalary)}</td>
      <td>${escapeHtml(t.tenureStart)} to ${escapeHtml(t.tenureEnd)}</td>
    </tr>
  `).join('');

  const relativeRows = report.relatives.map(r => `
    <tr>
      <td>${escapeHtml(r.lastName)}, ${escapeHtml(r.firstName)}${r.middleName ? ` ${escapeHtml(r.middleName)}` : ''}</td>
      <td>${escapeHtml(r.relationship)}</td>
      <td>${escapeHtml(_teacherNameForRelative(r))}</td>
      <td>${escapeHtml(r.birthDate)}</td>
      <td>${escapeHtml(r.birthCountry)}</td>
      <td>${escapeHtml(r.nationality)}</td>
    </tr>
  `).join('');

  container.innerHTML = `
    <div class="review-section">
      <h3>School</h3>
      <div class="review-field"><span class="review-label">School</span><span class="review-value">${escapeHtml(report.schoolName)}</span></div>
      <div class="review-field"><span class="review-label">School Year</span><span class="review-value">${escapeHtml(report.schoolYear)}</span></div>
      <div class="review-field"><span class="review-label">Contact</span><span class="review-value">${escapeHtml(report.contactFirstName)} ${escapeHtml(report.contactLastName)}</span></div>
      <div class="review-field"><span class="review-label">Email</span><span class="review-value">${escapeHtml(report.contactEmail)}</span></div>
    </div>
    <div class="review-section">
      <h3>Teachers (${report.teachers.length})</h3>
      <div class="review-table-wrapper">
        <table class="review-table"><thead><tr><th>Name</th><th>Email</th><th>M/F</th><th>Yr</th><th>DOB</th><th>Country</th><th>Nationality</th><th>Level</th><th>State</th><th>Salary</th><th>Tenure</th></tr></thead><tbody>${teacherRows}</tbody></table>
      </div>
    </div>
    ${report.relatives.length > 0 ? `
    <div class="review-section">
      <h3>Relatives (${report.relatives.length})</h3>
      <div class="review-table-wrapper">
        <table class="review-table"><thead><tr><th>Name</th><th>Relationship</th><th>Teacher</th><th>DOB</th><th>Country</th><th>Nationality</th></tr></thead><tbody>${relativeRows}</tbody></table>
      </div>
    </div>` : ''}
    <div class="review-section">
      <h3>Signature</h3>
      ${report.signature.imageDataUrl ? `<img src="${report.signature.imageDataUrl}" alt="Signature" style="max-width: 300px; border: 1px solid var(--color-border); border-radius: 4px; margin-bottom: 8px;">` : '<p>No signature</p>'}
      <div class="review-field"><span class="review-label">Name</span><span class="review-value">${escapeHtml(report.signature.signerName)}</span></div>
      <div class="review-field"><span class="review-label">Title</span><span class="review-value">${escapeHtml(report.signature.signerTitle)}</span></div>
    </div>
  `;
}

// ========================================
// PDF Generation
// ========================================

async function generateReport() {
  const overlay = document.getElementById('generatingOverlay');
  const statusEl = document.getElementById('generatingStatus');
  overlay.style.display = 'flex';

  try {
    const pdfBytes = await generatePDF(report, (s) => { statusEl.textContent = s; });
    const filename = generateFilename(report.schoolYear, report.schoolName);
    statusEl.textContent = 'Downloading...';
    downloadPDF(pdfBytes, filename);
    statusEl.textContent = 'Complete!';
    setTimeout(() => { overlay.style.display = 'none'; }, 1000);
  } catch (error) {
    console.error('PDF generation failed:', error);
    overlay.style.display = 'none';
    alert(`PDF generation failed: ${error.message}`);
  }
}

// ========================================
// Utilities
// ========================================

function showError(id, msg) { const el = document.getElementById(id); if (el) el.textContent = msg; }
function clearError(id) { const el = document.getElementById(id); if (el) el.textContent = ''; }

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

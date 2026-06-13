'use strict';
 
/* ── Constants ── */
const YEARS = ['Year 1','Year 2','Year 3','Year 4','Year 5','Year 6',
               'Year 7','Year 8','Year 9','Year 10','Year 11','Year 12'];
const PAGE_SIZE = 10;
 
/* ── localStorage ── */
function lsGet(key, fallback) {
  try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch(e) { return fallback; }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) {}
}
function saveAll() {
  lsSet('setec_students', students);
  lsSet('setec_teachers', teachers);
  lsSet('setec_classes',  classes);
  lsSet('setec_invoices', invoices);
}

var DRAFT_FIELDS = {
  stuDraft: ['sName','sYear','sGuardian','sPhone','sAttend','sFeeStatus','sBalance'],
  tchDraft: ['tName','tSubject','tEmail','tPhone','tClasses'],
  clsDraft: ['cSubject','cTeacher','cYear','cDay','cTime','cRoom'],
  invDraft: ['iStudent','iDesc','iAmount','iStatus','iDate']
};

function saveDraft(draftKey) {
  var fields = DRAFT_FIELDS[draftKey];
  if (!fields) return;
  var obj = {};
  for (var i = 0; i < fields.length; i++) {
    var el = document.getElementById(fields[i]);
    if (el) obj[fields[i]] = el.value;
  }
  lsSet(draftKey, obj);
}

function loadDraft(draftKey) {
  var draft = lsGet(draftKey, null);
  if (!draft) return;
  var fields = DRAFT_FIELDS[draftKey];
  if (!fields) return;
  for (var i = 0; i < fields.length; i++) {
    var el = document.getElementById(fields[i]);
    if (el && draft[fields[i]] !== undefined) el.value = draft[fields[i]];
  }
}

function clearDraft(draftKey) {
  try { localStorage.removeItem(draftKey); } catch(e) {}
}

function attachDraftListeners(draftKey) {
  
}

var _activeDraftKey = null;

function setActiveDraft(draftKey) {
  _activeDraftKey = draftKey;
}

function savePendingDraft() {
  if (_activeDraftKey) saveDraft(_activeDraftKey);
}

window.addEventListener('beforeunload', savePendingDraft);
document.addEventListener('visibilitychange', function() {
  if (document.visibilityState === 'hidden') savePendingDraft();
});
 
/* ── Data ── */
var students = lsGet('setec_students', []);
var teachers = lsGet('setec_teachers', []);
var classes  = lsGet('setec_classes',  []);
var invoices = lsGet('setec_invoices', []);
 
function nextId(arr, prefix) {
  prefix = prefix || '';
  var max = 0;
  for (var i = 0; i < arr.length; i++) {
    var raw = String(arr[i].id || '0');
    /* strip non-digit chars without regex */
    var digits = '';
    for (var j = 0; j < raw.length; j++) {
      if (raw[j] >= '0' && raw[j] <= '9') digits += raw[j];
    }
    var n = parseInt(digits || '0', 10) || 0;
    if (n > max) max = n;
  }
  var s = String(max + 1);
  while (s.length < 4) s = '0' + s;
  return prefix + s;
}
 
/* ── State ── */
var currentView = 'dashboard';
var attendRange = 14;
var stuSearch = '', stuGrade = 'all', stuFee = 'all', stuPage = 1;
var tchSearch = '', tchSubject = 'all', tchPage = 1;
var clsYear = 'all', clsDay = 'all', clsPage = 1;
var finStatus = 'all', finPage = 1;
var editType = null, editId = null;
 

var toastTimer;
function showToast(msg, type) {
  var el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast ' + (type || 'ok') + ' show';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function() { el.classList.remove('show'); }, 3000);
}
 
/* ── Validation helpers (no regex) ── */
function valRequired(val, min) {
  min = min || 2;
  return String(val || '').trim().length >= min;
}
function valEmail(v) {
  var s = String(v || '').trim();
  var at = s.indexOf('@');
  if (at < 1) return false;                        // must have char before @
  var domain = s.slice(at + 1);
  var dot = domain.lastIndexOf('.');
  if (dot < 1) return false;                       // must have char before dot
  var tld = domain.slice(dot + 1);
  return tld.length >= 2 && s.indexOf(' ') === -1; // tld >= 2, no spaces
}
function valPhone(v) {
  var s = String(v || '').trim();
  if (s.length < 6 || s.length > 15) return false;
  for (var i = 0; i < s.length; i++) {
    var c = s[i];
    var ok = (c >= '0' && c <= '9') || c === ' ' || c === '-' || c === '+';
    if (!ok) return false;
  }
  return true;
}
function valPhoneOpt(v) {
  var s = String(v || '').trim();
  return s === '' || valPhone(s);
}
function valNum(v, min, max) {
  var n = Number(v);
  return !isNaN(n) && n >= min && n <= max;
}
 
function setFieldErr(fieldId, errId, msg, show) {
  var f = document.getElementById(fieldId);
  var e = document.getElementById(errId);
  if (!f || !e) return;
  if (show) {
    f.classList.add('err');
    e.textContent = msg;
    e.classList.add('show');
  } else {
    f.classList.remove('err');
    e.classList.remove('show');
  }
}
function clearFormErr(formId) {
  var form = document.getElementById(formId);
  if (!form) return;
  var fields = form.querySelectorAll('.err');
  for (var i = 0; i < fields.length; i++) fields[i].classList.remove('err');
  var msgs = form.querySelectorAll('.err-msg.show');
  for (var i = 0; i < msgs.length; i++) msgs[i].classList.remove('show');
}
 
function validateStudent() {
  clearFormErr('stuForm');
  var ok = true;
  var name     = document.getElementById('sName').value;
  var year     = document.getElementById('sYear').value;
  var guardian = document.getElementById('sGuardian').value;
  var phone    = document.getElementById('sPhone').value;
  var attend   = document.getElementById('sAttend').value;
  var balance  = document.getElementById('sBalance').value;
 
  if (!valRequired(name, 2))        { setFieldErr('sName','sNameErr','Name is required (min 2 chars).',true); ok=false; }
  if (!year)                        { setFieldErr('sYear','sYearErr','Please select a year.',true); ok=false; }
  if (!valRequired(guardian, 2))    { setFieldErr('sGuardian','sGuardianErr','Guardian name is required.',true); ok=false; }
  if (!valPhoneOpt(phone))          { setFieldErr('sPhone','sPhoneErr','Enter a valid phone (6-15 digits).',true); ok=false; }
  if (!valNum(attend, 0, 100))      { setFieldErr('sAttend','sAttendErr','Attendance must be 0-100.',true); ok=false; }
  if (Number(balance) < 0)          { setFieldErr('sBalance','sBalanceErr','Balance cannot be negative.',true); ok=false; }
  return ok;
}
 
function validateTeacher() {
  clearFormErr('tchForm');
  var ok = true;
  var name  = document.getElementById('tName').value;
  var subj  = document.getElementById('tSubject').value;
  var email = document.getElementById('tEmail').value;
  var phone = document.getElementById('tPhone').value;
 
  if (!valRequired(name, 2)) { setFieldErr('tName','tNameErr','Name is required.',true); ok=false; }
  if (!subj)                 { setFieldErr('tSubject','tSubjectErr','Please select a subject.',true); ok=false; }
  if (!valEmail(email))      { setFieldErr('tEmail','tEmailErr','Enter a valid email address.',true); ok=false; }
  if (!valPhone(phone))      { setFieldErr('tPhone','tPhoneErr','Enter a valid phone (6-15 digits).',true); ok=false; }
  return ok;
}
 
function validateClass() {
  clearFormErr('clsForm');
  var ok = true;
  var subj    = document.getElementById('cSubject').value;
  var teacher = document.getElementById('cTeacher').value;
  var year    = document.getElementById('cYear').value;
  var day     = document.getElementById('cDay').value;
  var time    = document.getElementById('cTime').value;
 
  if (!valRequired(subj, 2)) { setFieldErr('cSubject','cSubjectErr','Subject is required.',true); ok=false; }
  if (!teacher)              { setFieldErr('cTeacher','cTeacherErr','Please assign a teacher.',true); ok=false; }
  if (!year)                 { setFieldErr('cYear','cYearErr','Please select a year.',true); ok=false; }
  if (!day)                  { setFieldErr('cDay','cDayErr','Please select a day.',true); ok=false; }
  if (!time)                 { setFieldErr('cTime','cTimeErr','Please set a time.',true); ok=false; }
  return ok;
}
 
function validateInvoice() {
  clearFormErr('invForm');
  var ok = true;
  var student = document.getElementById('iStudent').value;
  var desc    = document.getElementById('iDesc').value;
  var amount  = document.getElementById('iAmount').value;
  var date    = document.getElementById('iDate').value;
 
  if (!student)              { setFieldErr('iStudent','iStudentErr','Please select a student.',true); ok=false; }
  if (!valRequired(desc, 3)) { setFieldErr('iDesc','iDescErr','Description is required.',true); ok=false; }
  if (!valNum(amount, 0.01, 9999999)) { setFieldErr('iAmount','iAmountErr','Amount must be greater than 0.',true); ok=false; }
  if (!date)                 { setFieldErr('iDate','iDateErr','Please set a date.',true); ok=false; }
  return ok;
}
 
/* ── Navigation ── */
var VIEW_META = {
  dashboard: { title: 'Dashboard',  sub: "Today's overview of the institute." },
  students:  { title: 'Students',   sub: 'Manage student records, guardians and fees.' },
  teachers:  { title: 'Teachers',   sub: 'Staff records, subjects and class assignments.' },
  classes:   { title: 'Classes',    sub: 'Schedule, timetables and room allocation.' },
  finance:   { title: 'Finance',    sub: 'Invoices, fees and payment tracking.' }
};
 
function switchView(name) {
  currentView = name;
  lsSet('setec_lastView', name);
 
  
  var views = document.querySelectorAll('.view');
  for (var i = 0; i < views.length; i++) views[i].classList.remove('active');
  var target = document.getElementById('v-' + name);
  if (target) target.classList.add('active');
 
  
  var links = document.querySelectorAll('.nav-link');
  for (var i = 0; i < links.length; i++) {
    if (links[i].getAttribute('data-view') === name) {
      links[i].classList.add('active');
    } else {
      links[i].classList.remove('active');
    }
  }
 
  var meta = VIEW_META[name] || { title: name, sub: '' };
  document.getElementById('viewTitle').textContent = meta.title;
  document.getElementById('viewSub').textContent   = meta.sub;
 
  renderTopActions(name);
  renderView(name);
}
 
function renderTopActions(name) {
  var el = document.getElementById('topActions');
  el.innerHTML = '';
  if (name === 'dashboard') {
    addTopBtn(el, 'Print', '', function() { window.print(); });
  } else if (name === 'students') {
    addTopBtn(el, '+ Add Student', 'primary', function() { openStuModal(null); });
    addTopBtn(el, 'Export CSV', 'ghost', exportStudentsCsv);
    addTopBtn(el, 'Print', '', function() { window.print(); });
  } else if (name === 'teachers') {
    addTopBtn(el, '+ Add Teacher', 'primary', function() { openTchModal(null); });
  } else if (name === 'classes') {
    addTopBtn(el, '+ New Class', 'primary', function() { openClsModal(null); });
    addTopBtn(el, 'Print', '', function() { window.print(); });
  } else if (name === 'finance') {
    addTopBtn(el, '+ New Invoice', 'primary', function() { openInvModal(null); });
    addTopBtn(el, 'Export CSV', 'ghost', exportFinanceCsv);
    addTopBtn(el, 'Print', '', function() { window.print(); });
  }
}
 
function addTopBtn(parent, label, cls, fn) {
  var b = document.createElement('button');
  b.className = 'btn ' + (cls || '');
  b.type = 'button';
  b.textContent = label;
  b.addEventListener('click', fn);
  parent.appendChild(b);
}
 

function renderView(name) {
  if (name === 'dashboard') renderDashboard();
  if (name === 'students')  renderStudents();
  if (name === 'teachers')  renderTeachers();
  if (name === 'classes')   renderClasses();
  if (name === 'finance')   renderFinance();
}
 
/* ── Dashboard ── */
function renderDashboard() {
  var total = students.length;
  var avgA  = total ? Math.round(students.reduce(function(a,s){ return a+s.attendance; }, 0) / total) : 0;
  var owed  = students.reduce(function(a,s){ return a + (s.feeStatus !== 'Paid' ? s.balance : 0); }, 0);
  var tch   = teachers.length;
 
  setText('dKpiStudents', total);
  setText('dKpiBadge1',   total === 0 ? 'None yet' : total + ' registered');
  setText('dKpiAttend',   total ? avgA + '%' : '--');
  setText('dKpiBadge2',   total ? (100 - avgA) + '% absent' : '--');
  setText('dKpiTeachers', tch);
  setText('dKpiBadge3',   tch === 0 ? 'None yet' : tch + ' staff');
  setText('dKpiFees',     fmtMoney(owed));
  setText('dKpiBadge4',   owed === 0 ? 'All clear' : students.filter(function(s){ return s.feeStatus !== 'Paid'; }).length + ' owed');
  setText('dEnrollTotal', total);
 
  drawAttendChart();
  drawYearChart();
}
 
/* ── Students ── */
function filteredStudents() {
  var s = stuSearch.toLowerCase();
  return students.filter(function(x) {
    var ms = !s || x.name.toLowerCase().indexOf(s) > -1 || x.id.toLowerCase().indexOf(s) > -1 || x.grade.toLowerCase().indexOf(s) > -1;
    var mg = stuGrade === 'all' || x.grade === stuGrade;
    var mf = stuFee   === 'all' || x.feeStatus === stuFee;
    return ms && mg && mf;
  });
}
 
function renderStudents() {
  populateGradeFilter();
  var filtered   = filteredStudents();
  var totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  stuPage = Math.min(stuPage, totalPages);
  var rows = filtered.slice((stuPage - 1) * PAGE_SIZE, stuPage * PAGE_SIZE);
 
  var tbody = document.getElementById('studentsTbody');
  var empty = document.getElementById('studentsEmpty');
  tbody.innerHTML = '';
 
  if (students.length === 0) {
    empty.hidden = false;
    setText('stuCount', 'No students');
    setText('stuPage', '--');
    document.getElementById('stuPrev').disabled = true;
    document.getElementById('stuNext').disabled = true;
    return;
  }
  empty.hidden = true;
 
  for (var i = 0; i < rows.length; i++) {
    var s  = rows[i];
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td>' + esc(s.id) + '</td>' +
      '<td><b>' + esc(s.name) + '</b></td>' +
      '<td>' + esc(s.grade) + '</td>' +
      '<td>' + esc(s.guardian) + '</td>' +
      '<td>' + esc(s.phone || '--') + '</td>' +
      '<td>' + s.attendance + '%</td>' +
      '<td>' + statusPill(s.feeStatus) + '</td>' +
      '<td class="right">' + fmtMoney(s.balance) + '</td>' +
      '<td class="right no-print">' +
        '<div class="row-actions">' +
          '<button class="btn" type="button" onclick="openStuModal(\'' + s.id + '\')">Edit</button>' +
          '<button class="btn danger" type="button" onclick="deleteRec(\'students\',\'' + s.id + '\')">Delete</button>' +
        '</div></td>';
    tbody.appendChild(tr);
  }
  setText('stuCount', filtered.length + ' student(s)');
  setText('stuPage',  'Page ' + stuPage + ' / ' + totalPages);
  document.getElementById('stuPrev').disabled = stuPage <= 1;
  document.getElementById('stuNext').disabled = stuPage >= totalPages;
}
 
function populateGradeFilter() {
  var sel = document.getElementById('gradeFlt');
  if (sel.options.length <= 1) {
    for (var i = 0; i < YEARS.length; i++) {
      var o = document.createElement('option');
      o.value = o.textContent = YEARS[i];
      sel.appendChild(o);
    }
  }
}
 
/* ── Teachers ── */
function filteredTeachers() {
  var s = tchSearch.toLowerCase();
  return teachers.filter(function(x) {
    var ms   = !s || x.name.toLowerCase().indexOf(s) > -1 || x.subject.toLowerCase().indexOf(s) > -1;
    var msub = tchSubject === 'all' || x.subject === tchSubject;
    return ms && msub;
  });
}
 
function renderTeachers() {
  refreshSubjectFilter();
  var filtered   = filteredTeachers();
  var totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  tchPage = Math.min(tchPage, totalPages);
  var rows = filtered.slice((tchPage - 1) * PAGE_SIZE, tchPage * PAGE_SIZE);
 
  var tbody = document.getElementById('teachersTbody');
  var empty = document.getElementById('teachersEmpty');
  tbody.innerHTML = '';
 
  if (teachers.length === 0) {
    empty.hidden = false;
    setText('tchCount', 'No teachers');
    setText('tchPage', '--');
    document.getElementById('tchPrev').disabled = true;
    document.getElementById('tchNext').disabled = true;
    return;
  }
  empty.hidden = true;
 
  for (var i = 0; i < rows.length; i++) {
    var t  = rows[i];
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td>' + esc(t.id) + '</td>' +
      '<td><b>' + esc(t.name) + '</b></td>' +
      '<td>' + esc(t.subject) + '</td>' +
      '<td>' + esc(t.email) + '</td>' +
      '<td>' + esc(t.phone || '--') + '</td>' +
      '<td>' + esc(t.assignedClasses || '--') + '</td>' +
      '<td class="right no-print">' +
        '<div class="row-actions">' +
          '<button class="btn" type="button" onclick="openTchModal(\'' + t.id + '\')">Edit</button>' +
          '<button class="btn danger" type="button" onclick="deleteRec(\'teachers\',\'' + t.id + '\')">Delete</button>' +
        '</div></td>';
    tbody.appendChild(tr);
  }
  setText('tchCount', filtered.length + ' teacher(s)');
  setText('tchPage',  'Page ' + tchPage + ' / ' + totalPages);
  document.getElementById('tchPrev').disabled = tchPage <= 1;
  document.getElementById('tchNext').disabled = tchPage >= totalPages;
}
 
function refreshSubjectFilter() {
  var subjects = [];
  for (var i = 0; i < teachers.length; i++) {
    if (subjects.indexOf(teachers[i].subject) === -1) subjects.push(teachers[i].subject);
  }
  subjects.sort();
  var sel  = document.getElementById('subjectFlt');
  var curr = sel.value;
  sel.innerHTML = '<option value="all">All Subjects</option>';
  for (var i = 0; i < subjects.length; i++) {
    var o = document.createElement('option');
    o.value = o.textContent = subjects[i];
    sel.appendChild(o);
  }
  if (subjects.indexOf(curr) > -1) sel.value = curr;
}
 
/* ── Classes ── */
function filteredClasses() {
  return classes.filter(function(c) {
    return (clsYear === 'all' || c.year === clsYear) &&
           (clsDay  === 'all' || c.day  === clsDay);
  });
}
 
function renderClasses() {
  var filtered   = filteredClasses();
  var totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  clsPage = Math.min(clsPage, totalPages);
  var rows = filtered.slice((clsPage - 1) * PAGE_SIZE, clsPage * PAGE_SIZE);
 
  var tbody = document.getElementById('classesTbody');
  var empty = document.getElementById('classesEmpty');
  tbody.innerHTML = '';
 
  if (classes.length === 0) {
    empty.hidden = false;
    setText('clsCount', 'No classes');
    setText('clsPage', '--');
    document.getElementById('clsPrev').disabled = true;
    document.getElementById('clsNext').disabled = true;
    return;
  }
  empty.hidden = true;
 
  for (var i = 0; i < rows.length; i++) {
    var c  = rows[i];
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td>' + esc(c.id) + '</td>' +
      '<td><b>' + esc(c.subject) + '</b></td>' +
      '<td>' + esc(c.teacher || '--') + '</td>' +
      '<td>' + esc(c.year) + '</td>' +
      '<td>' + esc(c.day) + '</td>' +
      '<td>' + esc(c.time) + '</td>' +
      '<td>' + esc(c.room || '--') + '</td>' +
      '<td class="right no-print">' +
        '<div class="row-actions">' +
          '<button class="btn" type="button" onclick="openClsModal(\'' + c.id + '\')">Edit</button>' +
          '<button class="btn danger" type="button" onclick="deleteRec(\'classes\',\'' + c.id + '\')">Delete</button>' +
        '</div></td>';
    tbody.appendChild(tr);
  }
  setText('clsCount', filtered.length + ' class(es)');
  setText('clsPage',  'Page ' + clsPage + ' / ' + totalPages);
  document.getElementById('clsPrev').disabled = clsPage <= 1;
  document.getElementById('clsNext').disabled = clsPage >= totalPages;
}
 
/* ── Finance ── */
function filteredInvoices() {
  return invoices.filter(function(inv) {
    return finStatus === 'all' || inv.status === finStatus;
  });
}
 
function renderFinance() {
  var paid = invoices.filter(function(i){ return i.status === 'Paid'; })
                     .reduce(function(a,i){ return a + i.amount; }, 0);
  var owed = invoices.filter(function(i){ return i.status !== 'Paid'; })
                     .reduce(function(a,i){ return a + i.amount; }, 0);
  setText('finCollected',  fmtMoney(paid));
  setText('finOutstanding', fmtMoney(owed));
  setText('finCount', invoices.length);
 
  var filtered   = filteredInvoices();
  var totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  finPage = Math.min(finPage, totalPages);
  var rows = filtered.slice((finPage - 1) * PAGE_SIZE, finPage * PAGE_SIZE);
 
  var tbody = document.getElementById('finTbody');
  var empty = document.getElementById('finEmpty');
  tbody.innerHTML = '';
 
  if (invoices.length === 0) {
    empty.hidden = false;
    setText('finCountLabel', 'No invoices');
    setText('finPage', '--');
    document.getElementById('finPrev').disabled = true;
    document.getElementById('finNext').disabled = true;
    return;
  }
  empty.hidden = true;
 
  for (var i = 0; i < rows.length; i++) {
    var inv = rows[i];
    var tr  = document.createElement('tr');
    tr.innerHTML =
      '<td>' + esc(inv.id) + '</td>' +
      '<td>' + esc(inv.studentName || inv.studentId || '--') + '</td>' +
      '<td>' + esc(inv.desc) + '</td>' +
      '<td><b>' + fmtMoney(inv.amount) + '</b></td>' +
      '<td>' + statusPill(inv.status) + '</td>' +
      '<td>' + esc(inv.date) + '</td>' +
      '<td class="right no-print">' +
        '<div class="row-actions">' +
          '<button class="btn" type="button" onclick="openInvModal(\'' + inv.id + '\')">Edit</button>' +
          '<button class="btn danger" type="button" onclick="deleteRec(\'invoices\',\'' + inv.id + '\')">Delete</button>' +
        '</div></td>';
    tbody.appendChild(tr);
  }
  setText('finCountLabel', filtered.length + ' invoice(s)');
  setText('finPage', 'Page ' + finPage + ' / ' + totalPages);
  document.getElementById('finPrev').disabled = finPage <= 1;
  document.getElementById('finNext').disabled = finPage >= totalPages;
}
 
/* ── Delete ── */
function deleteRec(type, id) {
  if (!confirm('Delete this ' + type.slice(0,-1) + '?')) return;
  if (type === 'students') students = students.filter(function(x){ return x.id !== id; });
  if (type === 'teachers') teachers = teachers.filter(function(x){ return x.id !== id; });
  if (type === 'classes')  classes  = classes.filter(function(x){ return x.id !== id; });
  if (type === 'invoices') invoices = invoices.filter(function(x){ return x.id !== id; });
  saveAll();
  showToast('Deleted.', 'info');
  renderView(currentView);
  if (currentView !== 'finance') renderView('dashboard');
  renderView(currentView);
}
 

function openModal(id)  { document.getElementById(id).hidden = false; }
function closeModal(id) { document.getElementById(id).hidden = true; editType = null; editId = null; _activeDraftKey = null; }
 
function fillYears(selId) {
  var sel = document.getElementById(selId);
  if (!sel) return;
  if (sel.options.length > 0) return; 
  for (var i = 0; i < YEARS.length; i++) {
    var o = document.createElement('option');
    o.value = o.textContent = YEARS[i];
    sel.appendChild(o);
  }
}
 
function fillTeacherSelect() {
  var sel = document.getElementById('cTeacher');
  var cur = sel.value;
  sel.innerHTML = '<option value="">-- Select Teacher --</option>';
  for (var i = 0; i < teachers.length; i++) {
    var o = document.createElement('option');
    o.value = teachers[i].name;
    o.textContent = teachers[i].name + ' (' + teachers[i].subject + ')';
    sel.appendChild(o);
  }
  if (cur) sel.value = cur;
}
 
function fillStudentSelect() {
  var sel = document.getElementById('iStudent');
  var cur = sel.value;
  sel.innerHTML = '<option value="">-- Select Student --</option>';
  for (var i = 0; i < students.length; i++) {
    var o = document.createElement('option');
    o.value = students[i].id;
    o.textContent = students[i].name + ' (' + students[i].id + ')';
    sel.appendChild(o);
  }
  if (cur) sel.value = cur;
}
 
/* ── Student modal ── */
function openStuModal(id) {
  clearFormErr('stuForm');
  fillYears('sYear');
  if (id) {
    var s = null;
    for (var i = 0; i < students.length; i++) { if (students[i].id === id) { s = students[i]; break; } }
    if (!s) return;
    editType = 'student'; editId = id;
    setText('stuModalTitle', 'Edit Student (' + id + ')');
    document.getElementById('sName').value      = s.name;
    document.getElementById('sYear').value      = s.grade;
    document.getElementById('sGuardian').value  = s.guardian;
    document.getElementById('sPhone').value     = s.phone || '';
    document.getElementById('sAttend').value    = s.attendance;
    document.getElementById('sFeeStatus').value = s.feeStatus;
    document.getElementById('sBalance').value   = s.balance;
  } else {
    editType = 'student'; editId = null;
    setText('stuModalTitle', 'Add Student');
    document.getElementById('stuForm').reset();
    document.getElementById('sYear').value   = 'Year 7';
    document.getElementById('sAttend').value = 95;
    document.getElementById('sBalance').value = 0;
    loadDraft('stuDraft');
    setActiveDraft('stuDraft');
  }
  openModal('stuModal');
  document.getElementById('sName').focus();
}
 
document.getElementById('stuForm').addEventListener('submit', function(e) {
  e.preventDefault();
  if (!validateStudent()) return;
  var data = {
    name:       document.getElementById('sName').value.trim(),
    grade:      document.getElementById('sYear').value,
    guardian:   document.getElementById('sGuardian').value.trim(),
    phone:      document.getElementById('sPhone').value.trim(),
    attendance: Math.min(100, Math.max(0, parseInt(document.getElementById('sAttend').value, 10) || 0)),
    feeStatus:  document.getElementById('sFeeStatus').value,
    balance:    +Number(document.getElementById('sBalance').value || 0).toFixed(2)
  };
  if (editId) {
    for (var i = 0; i < students.length; i++) {
      if (students[i].id === editId) {
        students[i] = Object.assign({}, students[i], data);
        break;
      }
    }
    showToast('Student updated.', 'ok');
  } else {
    data.id = nextId(students, 'S');
    students.unshift(data);
    showToast('Student added.', 'ok');
  }
  saveAll();
  closeModal('stuModal');
  clearDraft('stuDraft');
  stuPage = 1;
  renderView(currentView);
  if (currentView !== 'dashboard') renderDashboard();
});
 
/* ── Teacher modal ── */
function openTchModal(id) {
  clearFormErr('tchForm');
  if (id) {
    var t = null;
    for (var i = 0; i < teachers.length; i++) { if (teachers[i].id === id) { t = teachers[i]; break; } }
    if (!t) return;
    editType = 'teacher'; editId = id;
    setText('tchModalTitle', 'Edit Teacher (' + id + ')');
    document.getElementById('tName').value           = t.name;
    document.getElementById('tSubject').value        = t.subject;
    document.getElementById('tEmail').value          = t.email;
    document.getElementById('tPhone').value          = t.phone || '';
    document.getElementById('tClasses').value        = t.assignedClasses || '';
  } else {
    editType = 'teacher'; editId = null;
    setText('tchModalTitle', 'Add Teacher');
    document.getElementById('tchForm').reset();
    loadDraft('tchDraft');
    setActiveDraft('tchDraft');
  }
  openModal('tchModal');
  document.getElementById('tName').focus();
}
 
document.getElementById('tchForm').addEventListener('submit', function(e) {
  e.preventDefault();
  if (!validateTeacher()) return;
  var data = {
    name:            document.getElementById('tName').value.trim(),
    subject:         document.getElementById('tSubject').value,
    email:           document.getElementById('tEmail').value.trim(),
    phone:           document.getElementById('tPhone').value.trim(),
    assignedClasses: document.getElementById('tClasses').value.trim()
  };
  if (editId) {
    for (var i = 0; i < teachers.length; i++) {
      if (teachers[i].id === editId) { teachers[i] = Object.assign({}, teachers[i], data); break; }
    }
    showToast('Teacher updated.', 'ok');
  } else {
    data.id = nextId(teachers, 'T');
    teachers.unshift(data);
    showToast('Teacher added.', 'ok');
  }
  saveAll();
  closeModal('tchModal');
  clearDraft('tchDraft');
  tchPage = 1;
  renderView(currentView);
});
 
/* ── Class modal ── */
function openClsModal(id) {
  clearFormErr('clsForm');
  fillYears('cYear');
  fillTeacherSelect();
  if (id) {
    var c = null;
    for (var i = 0; i < classes.length; i++) { if (classes[i].id === id) { c = classes[i]; break; } }
    if (!c) return;
    editType = 'class'; editId = id;
    setText('clsModalTitle', 'Edit Class (' + id + ')');
    document.getElementById('cSubject').value = c.subject;
    document.getElementById('cTeacher').value = c.teacher;
    document.getElementById('cYear').value    = c.year;
    document.getElementById('cDay').value     = c.day;
    document.getElementById('cTime').value    = c.time;
    document.getElementById('cRoom').value    = c.room || '';
  } else {
    editType = 'class'; editId = null;
    setText('clsModalTitle', 'New Class');
    document.getElementById('clsForm').reset();
    document.getElementById('cTime').value = '07:30';
    if (document.getElementById('cYear').options.length > 0)
      document.getElementById('cYear').value = 'Year 7';
    loadDraft('clsDraft');
    setActiveDraft('clsDraft');
  }
  openModal('clsModal');
}
 
document.getElementById('clsForm').addEventListener('submit', function(e) {
  e.preventDefault();
  if (!validateClass()) return;
  var data = {
    subject: document.getElementById('cSubject').value.trim(),
    teacher: document.getElementById('cTeacher').value,
    year:    document.getElementById('cYear').value,
    day:     document.getElementById('cDay').value,
    time:    document.getElementById('cTime').value,
    room:    document.getElementById('cRoom').value.trim()
  };
  if (editId) {
    for (var i = 0; i < classes.length; i++) {
      if (classes[i].id === editId) { classes[i] = Object.assign({}, classes[i], data); break; }
    }
    showToast('Class updated.', 'ok');
  } else {
    data.id = nextId(classes, 'C');
    classes.unshift(data);
    showToast('Class added.', 'ok');
  }
  saveAll();
  closeModal('clsModal');
  clearDraft('clsDraft');
  clsPage = 1;
  renderView(currentView);
});
 

function openInvModal(id) {
  clearFormErr('invForm');
  fillStudentSelect();
  var today = new Date().toISOString().slice(0, 10);
  if (id) {
    var inv = null;
    for (var i = 0; i < invoices.length; i++) { if (invoices[i].id === id) { inv = invoices[i]; break; } }
    if (!inv) return;
    editType = 'invoice'; editId = id;
    setText('invModalTitle', 'Edit Invoice (' + id + ')');
    document.getElementById('iStudent').value = inv.studentId || '';
    document.getElementById('iDesc').value    = inv.desc;
    document.getElementById('iAmount').value  = inv.amount;
    document.getElementById('iStatus').value  = inv.status;
    document.getElementById('iDate').value    = inv.date;
  } else {
    editType = 'invoice'; editId = null;
    setText('invModalTitle', 'New Invoice');
    document.getElementById('invForm').reset();
    document.getElementById('iAmount').value = 150;
    document.getElementById('iDate').value   = today;
    loadDraft('invDraft');
    setActiveDraft('invDraft');
  }
  openModal('invModal');
}
 
document.getElementById('invForm').addEventListener('submit', function(e) {
  e.preventDefault();
  if (!validateInvoice()) return;
  var studentId = document.getElementById('iStudent').value;
  var stuName   = '';
  for (var i = 0; i < students.length; i++) {
    if (students[i].id === studentId) { stuName = students[i].name; break; }
  }
  var data = {
    studentId:   studentId,
    studentName: stuName || studentId,
    desc:        document.getElementById('iDesc').value.trim(),
    amount:      +Number(document.getElementById('iAmount').value).toFixed(2),
    status:      document.getElementById('iStatus').value,
    date:        document.getElementById('iDate').value
  };
  if (editId) {
    for (var i = 0; i < invoices.length; i++) {
      if (invoices[i].id === editId) { invoices[i] = Object.assign({}, invoices[i], data); break; }
    }
    showToast('Invoice updated.', 'ok');
  } else {
    data.id = nextId(invoices, 'INV-');
    invoices.unshift(data);
    showToast('Invoice created.', 'ok');
  }
  saveAll();
  closeModal('invModal');
  clearDraft('invDraft');
  finPage = 1;
  renderView(currentView);
});
 
/* ── CSV Export ── */
function exportStudentsCsv() {
  var rows = filteredStudents();
  var h = ['ID','Name','Year','Guardian','Phone','Attendance','FeeStatus','Balance'];
  var lines = [h.join(',')];
  for (var i = 0; i < rows.length; i++) {
    var s = rows[i];
    lines.push([s.id, csvQ(s.name), csvQ(s.grade), csvQ(s.guardian), csvQ(s.phone||''),
                s.attendance+'%', s.feeStatus, s.balance.toFixed(2)].join(','));
  }
  dlCsv(lines.join('\n'), 'setec_students_' + todayStr() + '.csv');
  showToast('Students CSV exported.', 'info');
}
 
function exportFinanceCsv() {
  var rows = filteredInvoices();
  var h = ['Invoice#','Student','Description','Amount','Status','Date'];
  var lines = [h.join(',')];
  for (var i = 0; i < rows.length; i++) {
    var inv = rows[i];
    lines.push([inv.id, csvQ(inv.studentName||''), csvQ(inv.desc),
                inv.amount.toFixed(2), inv.status, inv.date].join(','));
  }
  dlCsv(lines.join('\n'), 'setec_finance_' + todayStr() + '.csv');
  showToast('Finance CSV exported.', 'info');
}
 
function dlCsv(content, filename) {
  var blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
 
function csvQ(v) {
  var s = String(v == null ? '' : v);
  /* check for comma, double-quote, or newline without regex */
  var needsQuote = false;
  for (var i = 0; i < s.length; i++) {
    var c = s[i];
    if (c === '"' || c === ',' || c === '\n') { needsQuote = true; break; }
  }
  if (!needsQuote) return s;
  /* escape existing double-quotes by doubling them */
  var escaped = '';
  for (var i = 0; i < s.length; i++) {
    escaped += s[i] === '"' ? '""' : s[i];
  }
  return '"' + escaped + '"';
}
function todayStr() { return new Date().toISOString().slice(0, 10); }
 
/* ── Charts ── */
var PALETTE = ['#5b9bff','#7a55ff','#1fd98c','#f5c842','#ff5a5a',
               '#4dd7ff','#a78bfa','#34d399','#f59e0b','#fb7185','#60a5fa','#22c55e'];
 
function drawAttendChart() {
  var canvas = document.getElementById('attendChart');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var dpr = window.devicePixelRatio || 1;
  var rect = canvas.getBoundingClientRect();
  var W = Math.max(400, Math.floor(rect.width * dpr));
  var H = 240 * dpr;
  canvas.width = W; canvas.height = H;
 
  var days = attendRange;
  var avgA = students.length
    ? Math.round(students.reduce(function(a,s){ return a+s.attendance; }, 0) / students.length)
    : 85;
  var data = makeTrend(avgA, days);
  var pad  = { l:44, r:16, t:14, b:30 };
  var iw   = W - pad.l - pad.r;
  var ih   = H - pad.t - pad.b;
  var minY = 60, maxY = 100;
 
  ctx.clearRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(255,255,255,.07)';
  ctx.lineWidth = 1;
  for (var i = 0; i <= 5; i++) {
    var y = pad.t + (ih * i / 5);
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + iw, y); ctx.stroke();
    var lbl = Math.round(maxY - (maxY - minY) * (i / 5));
    ctx.fillStyle = 'rgba(231,238,252,.6)';
    ctx.font = (11 * dpr) + 'px system-ui';
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(lbl, pad.l - 8, y);
  }
 
  function xFor(i) { return pad.l + (iw * (i / Math.max(1, data.length - 1))); }
  function yFor(v) { return pad.t + ih * (1 - ((v - minY) / (maxY - minY))); }
 

  ctx.save();
  ctx.strokeStyle = 'rgba(122,85,255,.7)';
  ctx.lineWidth = 1.5 * dpr;
  ctx.setLineDash([6 * dpr, 5 * dpr]);
  ctx.beginPath(); ctx.moveTo(pad.l, yFor(90)); ctx.lineTo(pad.l + iw, yFor(90));
  ctx.stroke(); ctx.restore();
 
  
  ctx.save();
  ctx.beginPath();
  for (var i = 0; i < data.length; i++) {
    var x = xFor(i), yy = yFor(data[i]);
    if (i === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
  }
  ctx.lineTo(pad.l + iw, pad.t + ih); ctx.lineTo(pad.l, pad.t + ih); ctx.closePath();
  var area = ctx.createLinearGradient(0, pad.t, 0, pad.t + ih);
  area.addColorStop(0, 'rgba(91,155,255,.2)'); area.addColorStop(1, 'rgba(91,155,255,0)');
  ctx.fillStyle = area; ctx.fill(); ctx.restore();
 
  /* line */
  var grad = ctx.createLinearGradient(pad.l, 0, pad.l + iw, 0);
  grad.addColorStop(0, '#5b9bff'); grad.addColorStop(1, '#7a55ff');
  ctx.save();
  ctx.strokeStyle = grad; ctx.lineWidth = 2.5 * dpr;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath();
  for (var i = 0; i < data.length; i++) {
    var x = xFor(i), yy = yFor(data[i]);
    if (i === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
  }
  ctx.stroke(); ctx.restore();
}
 
function drawYearChart() {
  var canvas = document.getElementById('yearChart');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var dpr = window.devicePixelRatio || 1;
  var rect = canvas.getBoundingClientRect();
  var W = Math.max(400, Math.floor(rect.width * dpr));
  var H = 220 * dpr;
  canvas.width = W; canvas.height = H;
  ctx.clearRect(0, 0, W, H);
 
  var counts = {};
  for (var i = 0; i < YEARS.length; i++) counts[YEARS[i]] = 0;
  for (var i = 0; i < students.length; i++) {
    if (counts[students[i].grade] !== undefined) counts[students[i].grade]++;
  }
 
  var entries = [];
  for (var k in counts) { if (counts[k] > 0) entries.push([k, counts[k]]); }
  var total = entries.reduce(function(a, e){ return a + e[1]; }, 0);
  setText('dEnrollTotal', total);
 
  if (total === 0) {
    ctx.fillStyle = 'rgba(155,178,216,.4)';
    ctx.font = (13 * dpr) + 'px system-ui';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('No student data yet', W / 2, H / 2);
    document.getElementById('yearLegend').innerHTML = '';
    return;
  }
 
  var cx = W * 0.32, cy = H * 0.52;
  var rO = Math.min(W, H) * 0.34, rI = rO * 0.6;
  var angle = -Math.PI / 2;
  for (var i = 0; i < entries.length; i++) {
    var slice = (entries[i][1] / total) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, rO, angle, angle + slice); ctx.closePath();
    ctx.fillStyle = PALETTE[i % PALETTE.length] + 'dd'; ctx.fill();
    angle += slice;
  }
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath(); ctx.arc(cx, cy, rI, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
 
  ctx.fillStyle = 'rgba(232,239,254,.9)';
  ctx.font = 'bold ' + Math.round(16 * dpr) + 'px system-ui';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('Students', cx, cy - 10);
  ctx.fillStyle = 'rgba(139,164,204,.8)';
  ctx.font = Math.round(12 * dpr) + 'px system-ui';
  ctx.fillText(total + ' total', cx, cy + 14);
 
  var leg = document.getElementById('yearLegend');
  leg.innerHTML = '';
  for (var i = 0; i < entries.length; i++) {
    var pct  = Math.round((entries[i][1] / total) * 100);
    var span = document.createElement('span');
    span.className = 'leg-key';
    span.innerHTML = '<i class="swatch" style="background:' + PALETTE[i % PALETTE.length] + '"></i>' +
                     entries[i][0] + ': ' + entries[i][1] + ' (' + pct + '%)';
    leg.appendChild(span);
  }
}
 
function makeTrend(base, days) {
  var v   = Math.min(99, Math.max(70, base));
  var arr = [];
  for (var i = 0; i < days; i++) {
    var drift = (Math.random() - 0.47) * 1.5;
    var shock = (Math.random() < 0.07) ? (Math.random() - 0.5) * 6 : 0;
    v = Math.min(100, Math.max(65, Math.round(v + drift + shock)));
    arr.push(v);
  }
  return arr.map(function(x, i, a) {
    var prev = a[Math.max(0, i - 1)], next = a[Math.min(a.length - 1, i + 1)];
    return Math.round((prev + x * 2 + next) / 4);
  });
}
 

function setText(id, val) {
  var el = document.getElementById(id);
  if (el) el.textContent = val;
}
function fmtMoney(n) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(n || 0));
}
function esc(s) {
  var d = document.createElement('div');
  d.textContent = String(s == null ? '' : s);
  return d.innerHTML;
}
function statusPill(st) {
  return '<span class="status-pill ' + st.toLowerCase() + '"><i></i>' + esc(st) + '</span>';
}
 

function setupEvents() {
  /* Nav */
  document.getElementById('mainNav').addEventListener('click', function(e) {
    var btn = e.target.closest('.nav-link');
    if (btn && btn.getAttribute('data-view')) {
      switchView(btn.getAttribute('data-view'));
    }
  });
 
  
  document.getElementById('globalSearch').addEventListener('input', function(e) {
    var v = e.target.value.trim().toLowerCase();
    if (currentView === 'students') { stuSearch = v; stuPage = 1; renderStudents(); }
    if (currentView === 'teachers') { tchSearch = v; tchPage = 1; renderTeachers(); }
  });
 
  
  document.getElementById('btnAddStudentView').addEventListener('click', function() { openStuModal(null); });
  document.getElementById('btnExportStudents').addEventListener('click', exportStudentsCsv);
  document.getElementById('btnResetFilters').addEventListener('click', function() {
    document.getElementById('gradeFlt').value = 'all';
    document.getElementById('feeFlt').value   = 'all';
    document.getElementById('globalSearch').value = '';
    stuGrade = 'all'; stuFee = 'all'; stuSearch = ''; stuPage = 1;
    renderStudents();
  });
  document.getElementById('gradeFlt').addEventListener('change', function(e) { stuGrade = e.target.value; stuPage = 1; renderStudents(); });
  document.getElementById('feeFlt').addEventListener('change',   function(e) { stuFee   = e.target.value; stuPage = 1; renderStudents(); });
  document.getElementById('stuPrev').addEventListener('click', function() { stuPage--; renderStudents(); });
  document.getElementById('stuNext').addEventListener('click', function() { stuPage++; renderStudents(); });
 
  
  document.getElementById('btnAddTeacherView').addEventListener('click', function() { openTchModal(null); });
  document.getElementById('btnResetTeacherFilter').addEventListener('click', function() {
    tchSubject = 'all'; document.getElementById('subjectFlt').value = 'all'; renderTeachers();
  });
  document.getElementById('subjectFlt').addEventListener('change', function(e) { tchSubject = e.target.value; tchPage = 1; renderTeachers(); });
  document.getElementById('tchPrev').addEventListener('click', function() { tchPage--; renderTeachers(); });
  document.getElementById('tchNext').addEventListener('click', function() { tchPage++; renderTeachers(); });
 
  
  document.getElementById('btnAddClassView').addEventListener('click', function() { openClsModal(null); });
  document.getElementById('btnResetClassFilter').addEventListener('click', function() {
    clsYear = 'all'; clsDay = 'all';
    document.getElementById('classYearFlt').value = 'all';
    document.getElementById('classDayFlt').value  = 'all';
    renderClasses();
  });
  document.getElementById('classYearFlt').addEventListener('change', function(e) { clsYear = e.target.value; clsPage = 1; renderClasses(); });
  document.getElementById('classDayFlt').addEventListener('change',  function(e) { clsDay  = e.target.value; clsPage = 1; renderClasses(); });
  document.getElementById('clsPrev').addEventListener('click', function() { clsPage--; renderClasses(); });
  document.getElementById('clsNext').addEventListener('click', function() { clsPage++; renderClasses(); });
 
 
  document.getElementById('btnAddInvoice').addEventListener('click', function() { openInvModal(null); });
  document.getElementById('btnExportFin').addEventListener('click', exportFinanceCsv);
  document.getElementById('btnResetFinFilter').addEventListener('click', function() {
    finStatus = 'all'; document.getElementById('finStatusFlt').value = 'all'; renderFinance();
  });
  document.getElementById('finStatusFlt').addEventListener('change', function(e) { finStatus = e.target.value; finPage = 1; renderFinance(); });
  document.getElementById('finPrev').addEventListener('click', function() { finPage--; renderFinance(); });
  document.getElementById('finNext').addEventListener('click', function() { finPage++; renderFinance(); });
 

  document.getElementById('stuModalClose').addEventListener('click',  function() { closeModal('stuModal'); });
  document.getElementById('stuModalCancel').addEventListener('click', function() { closeModal('stuModal'); });
  document.getElementById('tchModalClose').addEventListener('click',  function() { closeModal('tchModal'); });
  document.getElementById('tchModalCancel').addEventListener('click', function() { closeModal('tchModal'); });
  document.getElementById('clsModalClose').addEventListener('click',  function() { closeModal('clsModal'); });
  document.getElementById('clsModalCancel').addEventListener('click', function() { closeModal('clsModal'); });
  document.getElementById('invModalClose').addEventListener('click',  function() { closeModal('invModal'); });
  document.getElementById('invModalCancel').addEventListener('click', function() { closeModal('invModal'); });
 
 
  var modals = ['stuModal','tchModal','clsModal','invModal'];
  for (var i = 0; i < modals.length; i++) {
    (function(id) {
      document.getElementById(id).addEventListener('click', function(e) {
        if (e.target === e.currentTarget) closeModal(id);
      });
    })(modals[i]);
  }
 

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      for (var i = 0; i < modals.length; i++) {
        var m = document.getElementById(modals[i]);
        if (!m.hidden) { closeModal(modals[i]); break; }
      }
    }
  });

  document.getElementById('trendSeg').addEventListener('click', function(e) {
    var btn = e.target.closest('.seg-btn');
    if (!btn) return;
    var btns = document.querySelectorAll('#trendSeg .seg-btn');
    for (var i = 0; i < btns.length; i++) btns[i].classList.remove('active');
    btn.classList.add('active');
    attendRange = parseInt(btn.getAttribute('data-range'), 10);
    drawAttendChart();
  });
 
  document.addEventListener('click', function(e) {
    var qa = e.target.closest('[data-qa]');
    if (!qa) return;
    var action = qa.getAttribute('data-qa');
    if (action === 'addStudent')  { switchView('students'); openStuModal(null); }
    if (action === 'addTeacher')  { switchView('teachers'); openTchModal(null); }
    if (action === 'addClass')    { switchView('classes');  openClsModal(null); }
    if (action === 'printReport') { window.print(); }
  });
 

  var cyf = document.getElementById('classYearFlt');
  for (var i = 0; i < YEARS.length; i++) {
    var o = document.createElement('option');
    o.value = o.textContent = YEARS[i];
    cyf.appendChild(o);
  }
 
  window.addEventListener('resize', function() {
    if (currentView === 'dashboard') { drawAttendChart(); drawYearChart(); }
  });
}
 

setupEvents();
attachDraftListeners('stuDraft');
attachDraftListeners('tchDraft');
attachDraftListeners('clsDraft');
attachDraftListeners('invDraft');
switchView(lsGet('setec_lastView', 'dashboard') || 'dashboard');
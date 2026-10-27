'use strict';

/* Versi statis baca-saja. Tidak memuat API PHP, session, login, atau data individu. */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const NAV = [
  ['dash', 'Dashboard'],
  ['setup', 'Data & Set Up'],
  ['mon', 'Monitoring SDM', ['Ringkasan SDM', 'Monitoring Karyawan', 'Monitoring Struktur Jabatan', 'Monitoring Non-Definitif']],
  ['mp', 'Manpower Planning', ['Gap Formasi', 'Proyeksi Pensiun']],
  ['sotk', 'SOTK & Outlet', ['SOTK Explorer', 'Snapshot Outlet']],
  ['intel', 'SDM Intelligence', ['Vacancy Priority', 'Grade Mismatch', 'Definitive Placement', 'Validasi Mapping SOTK']]
];
const ICONS = {
  dash: 'M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6V11h-6v9Zm0-16v5h6V4h-6Z',
  setup: 'M12 3l1.6 2.9 3.2.6-2.3 2.3.5 3.2L12 10.5 9 12l.5-3.2L7.2 6.5l3.2-.6L12 3Zm-7 12h4v6H5v-6Zm14 0h-4v6h4v-6Z',
  mon: 'M9 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm1 4h4M10 11h4M10 15h2',
  mp: 'M4 19V5m5 14V9m5 10V13m5 6V7',
  sotk: 'M4 6h16M4 12h16M4 18h10',
  intel: 'M12 2l2.4 5 5.6.8-4 4 1 5.6L12 15l-5 2.4 1-5.6-4-4 5.6-.8L12 2Z'
};
const S = { data: null, loadError: '', menu: 'dash', tab: 0, charts: [] };
const fmt = value => Number(value || 0).toLocaleString('id-ID');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isReady = () => !!(S.data && S.data.status === 'ready' && S.data.summary && typeof S.data.summary === 'object');
const summary = () => isReady() ? S.data.summary : null;
const levelNames = ['Kantor Wilayah', 'Kantor Area', 'Cabang'];

function iconSvg(path) {
  return `<i aria-hidden="true"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"></path></svg></i>`;
}
function setAlert(message, kind = 'info') {
  const target = $('#publication-alert');
  if (!target) return;
  if (!message) { target.innerHTML = ''; return; }
  target.innerHTML = `<div class="public-alert ${kind === 'warn' ? 'warn' : kind === 'error' ? 'error' : ''}"><span aria-hidden="true">${kind === 'error' ? '!' : kind === 'warn' ? 'i' : '✓'}</span><div><strong>${kind === 'error' ? 'Data publikasi tidak dapat dimuat' : kind === 'warn' ? 'Batasan versi publik' : 'Mode publik baca-saja'}</strong><p>${esc(message)}</p></div></div>`;
}
function kpi(label, value, note = '') {
  return `<div class="card kpi"><small>${esc(label)}</small><b>${esc(value)}</b>${note ? `<span class="mu" style="font-size:11.5px">${esc(note)}</span>` : ''}</div>`;
}
function emptyCard(title, message, icon = '◫') {
  return `<div class="card public-empty"><div class="em-ic">${icon}</div><h3>${esc(title)}</h3><p>${esc(message)}</p></div>`;
}
function needData() {
  if (isReady()) return '';
  const title = S.loadError ? 'Data publikasi belum dapat dibaca' : 'Belum ada data publikasi';
  const message = S.loadError || (S.data && S.data.message) || 'File data/dashboard.json belum tersedia atau belum berisi hasil ekspor. Jalankan ekspor lokal dan terbitkan berkas JSON yang telah diperiksa.';
  return emptyCard(title, message, '◫');
}
function drawNav() {
  const groups = [NAV.slice(0, 2), NAV.slice(2)];
  $('#nav').innerHTML = groups.map((group, index) => `<div class="nav-lbl">${index === 0 ? 'UTAMA' : 'MODUL SDM'}</div>${group.map(item => `<a href="#${item[0]}" data-menu="${item[0]}" class="${S.menu === item[0] ? 'on' : ''}" ${S.menu === item[0] ? 'aria-current="page"' : ''}>${iconSvg(ICONS[item[0]])}<span>${esc(item[1])}</span></a>`).join('')}`).join('');
  $$('#nav a[data-menu]').forEach(a => a.addEventListener('click', event => {
    event.preventDefault(); go(a.dataset.menu, 0);
  }));
  $('#stat').textContent = isReady() ? `${fmt(S.data.summary.employee_total)} pegawai · ringkasan` : 'Mode publik';
}
function drawTabs(item) {
  const tabs = item[2] || [];
  $('#tabs').innerHTML = tabs.map((tab, i) => `<a role="tab" href="#${item[0]}-${i}" aria-selected="${i === S.tab ? 'true' : 'false'}" class="${i === S.tab ? 'on' : ''}" data-tab="${i}">${esc(tab)}</a>`).join('');
  $$('#tabs a[data-tab]').forEach(a => a.addEventListener('click', event => {
    event.preventDefault(); go(S.menu, Number(a.dataset.tab));
  }));
}
function destroyCharts() {
  S.charts.forEach(chart => { try { chart.destroy(); } catch (_) {} });
  S.charts = [];
}
function chartCard(id, title, description) {
  return `<div class="card public-chart-card"><h3>${esc(title)}</h3><p>${esc(description)}</p><div class="public-chart-wrap"><canvas id="${esc(id)}" aria-label="${esc(title)}" role="img"></canvas></div></div>`;
}
function makeChart(id, kind, labels, values, label) {
  const canvas = document.getElementById(id);
  if (!canvas || !window.Chart || !labels.length || labels.length !== values.length) return;
  S.charts.push(new Chart(canvas, {
    type: kind,
    data: { labels, datasets: [{ label, data: values, backgroundColor: ['#00843D','#00A651','#77C99A','#B9E5CA','#E0F3E7'], borderColor: '#00843D', borderWidth: kind === 'line' ? 2 : 0, borderRadius: kind === 'bar' ? 6 : 0 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: kind === 'doughnut', position: 'bottom' } }, scales: kind === 'doughnut' ? {} : { y: { beginAtZero: true, ticks: { precision: 0 } } } }
  }));
}
function levelTable() {
  const rows = summary()?.sotk_by_level || [];
  if (!rows.length) return emptyCard('Ringkasan SOTK tidak tersedia', 'Tidak ada ringkasan SOTK yang dipublikasikan pada ekspor terakhir.');
  return `<div class="card"><div class="section-t"><h3>Ringkasan SOTK per Tingkat Organisasi</h3><p>Hanya jumlah agregat yang dipublikasikan; rincian unit, kode, jabatan, dan baris master tidak ditampilkan.</p></div><div class="public-table-wrap"><table><thead><tr><th>Tingkat Organisasi</th><th>Jumlah Baris Master</th><th>Total Formasi</th></tr></thead><tbody>${rows.map(row => `<tr><td>${esc(row.level)}</td><td>${fmt(row.row_count)}</td><td>${fmt(row.formasi_total)}</td></tr>`).join('')}</tbody></table></div></div>`;
}
function distributionCard(title, description, distribution, labelKey, countKey) {
  if (!Array.isArray(distribution) || !distribution.length) return emptyCard(title, 'Rincian ini tidak diterbitkan karena belum tersedia atau tidak memenuhi ambang agregasi minimum untuk menjaga privasi.');
  return `<div class="card public-section"><h3>${esc(title)}</h3><p>${esc(description)}</p><div class="public-table-wrap"><table><thead><tr><th>Kategori</th><th>Jumlah agregat</th></tr></thead><tbody>${distribution.map(row => `<tr><td>${esc(row[labelKey])}</td><td>${fmt(row[countKey])}</td></tr>`).join('')}</tbody></table></div><p class="public-footnote">Kategori kecil disembunyikan oleh proses ekspor jika tidak memenuhi ambang minimum.</p></div>`;
}
function renderDashboard() {
  const d = summary();
  if (!d) { $('#view').innerHTML = needData(); return; }
  $('#view').innerHTML = `
    <section class="public-hero"><div><small>SISTEM INFORMASI · RINGKASAN PUBLIK</small><h2>Monitoring SDM Pegadaian</h2><p>Ringkasan statistik berdasarkan ekspor lokal yang telah disetujui. Dashboard publik tidak memuat detail pegawai individual atau menyediakan fungsi perubahan data.</p></div><span class="public-readonly">◉ Baca saja</span></section>
    <div class="public-grid">${kpi('Total Pegawai', fmt(d.employee_total), 'Jumlah agregat pada batch aktif')}${kpi('Total Formasi SOTK', fmt(d.sotk_formasi_total), 'Agregat lintas tingkat organisasi')}${kpi('Baris Master SOTK', fmt(d.sotk_rows_total), 'Tanpa rincian baris')}${kpi('Data Terakhir Diekspor', S.data.generated_at ? new Date(S.data.generated_at).toLocaleString('id-ID') : 'Tidak tersedia', 'Waktu ekspor lokal')}</div>
    <div class="two dashboard-two">${chartCard('publicEmployeeChart','Jumlah Pegawai per Tingkat Organisasi','Grafik hanya ditampilkan apabila seluruh kelompok memenuhi ambang agregasi minimum.')}${chartCard('publicFormationChart','Total Formasi SOTK per Tingkat Organisasi','Ringkasan jumlah formasi dari master aktif, bukan rincian posisi.')}</div>
    <div id="publicPrivacyNote"></div>
    ${levelTable()}`;
  const byLevel = d.organization_level_distribution;
  makeChart('publicEmployeeChart', 'bar', Array.isArray(byLevel) ? byLevel.map(x => x.level) : [], Array.isArray(byLevel) ? byLevel.map(x => x.count) : [], 'Pegawai');
  const formation = d.sotk_by_level || [];
  makeChart('publicFormationChart', 'bar', formation.map(x => x.level), formation.map(x => Number(x.formasi_total || 0)), 'Formasi');
  if (!Array.isArray(byLevel) || !byLevel.length) {
    $('#publicPrivacyNote').innerHTML = `<div class="public-alert warn"><span aria-hidden="true">i</span><div><strong>Rincian jumlah pegawai per tingkat tidak ditampilkan</strong><p>Ekspor tidak memublikasikan pemecahan kelompok jika kategori terlalu kecil atau tidak lengkap. Total keseluruhan tetap ditampilkan jika memenuhi kebijakan publikasi.</p></div></div>`;
  }
}
function renderSetup() {
  const meta = isReady() ? S.data.metadata || {} : {};
  $('#view').innerHTML = `<section class="public-hero"><div><small>DATA &amp; SET UP</small><h2>Status Publikasi Data</h2><p>Halaman ini hanya menampilkan status publikasi. Pengelolaan database dan proses ekspor dilakukan dari komputer lokal oleh pemilik data.</p></div><span class="public-readonly">Tidak ada fitur upload</span></section>
    <div class="public-grid">${kpi('Status', isReady() ? 'Tersedia' : 'Belum tersedia')}${kpi('Ekspor Terakhir', isReady() && S.data.generated_at ? new Date(S.data.generated_at).toLocaleString('id-ID') : '—')}${kpi('Ambang kelompok minimum', S.data?.privacy?.minimum_group_size ? fmt(S.data.privacy.minimum_group_size) : '5', 'Kelompok kecil dapat disembunyikan')}${kpi('Catatan individu', 'Tidak dipublikasikan')}</div>
    <div class="card"><div class="section-t"><h3>Informasi Publikasi</h3><p>Data yang tersedia merupakan ringkasan agregat hasil ekspor lokal.</p></div><div class="mini"><span>Ruang lingkup</span><b>Statistik agregat saja</b></div><div class="mini"><span>Master SOTK aktif</span><b>${meta.sotk_active ? 'Tersedia' : isReady() ? 'Tidak tersedia' : 'Belum diekspor'}</b></div><div class="mini"><span>Batch data karyawan</span><b>${meta.employee_batch_active ? 'Tersedia' : isReady() ? 'Tidak tersedia' : 'Belum diekspor'}</b></div><div class="mini"><span>Baris individu di JSON</span><b>0</b></div></div>
    <div class="public-alert warn"><span aria-hidden="true">i</span><div><strong>Pembaruan dikelola secara lokal</strong><p>Ubah database melalui XAMPP/phpMyAdmin, jalankan skrip ekspor di folder proyek lokal, periksa JSON hasilnya, lalu terbitkan hanya isi folder <code>github-pages-public</code>. Jangan unggah folder aplikasi asli, database, backup, atau konfigurasi.</p></div></div>`;
}
function renderMonitoring(tab) {
  const d = summary();
  if (!d) { $('#view').innerHTML = needData(); return; }
  if (tab === 0) {
    const posDist = d.position_type_distribution;
    const defCount = Array.isArray(posDist) ? posDist.find(x => x.type === 'Definitif') : null;
    const nonDefCount = Array.isArray(posDist) ? posDist.find(x => x.type === 'Non-definitif') : null;
    const defLabel = Array.isArray(posDist) ? (defCount ? fmt(defCount.count) : '—') : 'Disembunyikan';
    const nonDefLabel = Array.isArray(posDist) ? (nonDefCount ? fmt(nonDefCount.count) : '—') : 'Disembunyikan';
    $('#view').innerHTML = `<div class="section-t"><h3>Ringkasan SDM</h3><p>Angka agregat dari batch aktif yang sudah diekspor.</p></div><div class="public-grid">${kpi('Total Pegawai', fmt(d.employee_total))}${kpi('Pegawai Definitif', defLabel)}${kpi('Pegawai Non-Definitif', nonDefLabel)}</div>${distributionCard('Jumlah Pegawai per Tingkat Organisasi','Rincian agregat Kantor Wilayah, Kantor Area, dan Cabang.', d.organization_level_distribution, 'level', 'count')}${distributionCard('Komposisi Position Type','Hanya kategori agregat yang memenuhi ambang privasi.', d.position_type_distribution, 'type', 'count')}`;
    return;
  }
  if (tab === 1) {
    $('#view').innerHTML = `<div class="section-t"><h3>Monitoring Karyawan</h3><p>Versi GitHub Pages tidak memuat tabel individu.</p></div>${emptyCard('Rincian karyawan tidak dipublikasikan', 'Tabel berisi nama, NIK, jabatan, grade, unit, atau atribut individu tetap berada di aplikasi lokal. Halaman publik hanya memuat angka agregat yang telah disetujui.', '◉')}`;
    return;
  }
  if (tab === 2) {
    $('#view').innerHTML = `<div class="section-t"><h3>Monitoring Struktur Jabatan</h3><p>Statistik tingkat organisasi, tanpa nama jabatan, kode unit, atau baris pegawai.</p></div>${levelTable()}${distributionCard('Karyawan per Tingkat Organisasi','Rincian ditampilkan hanya apabila lolos ambang agregasi.', d.organization_level_distribution, 'level', 'count')}`;
    return;
  }
  $('#view').innerHTML = `<div class="section-t"><h3>Monitoring Non-Definitif</h3><p>Jumlah agregat saja jika hasil ekspor memenuhi ambang privasi.</p></div>${distributionCard('Komposisi Position Type','Kategori yang sangat kecil disembunyikan agar tidak mudah diturunkan kembali.', d.position_type_distribution, 'type', 'count')}${emptyCard('Detail individu tidak tersedia', 'Nama, TMT, jabatan, dan tanggal status tidak dikirim ke website publik karena dapat mengidentifikasi pegawai.', '◉')}`;
}
function renderManpower(tab) {
  if (!isReady()) { $('#view').innerHTML = needData(); return; }
  if (tab === 0) {
    $('#view').innerHTML = `<div class="section-t"><h3>Gap Formasi</h3><p>Versi publik menampilkan total agregat SOTK, bukan gap per jabatan atau unit.</p></div>${levelTable()}<div class="public-alert warn"><span aria-hidden="true">i</span><div><strong>Gap posisi tidak dihitung dari angka total saja</strong><p>Perhitungan gap yang akurat membutuhkan pencocokan formasi dengan karyawan definitif per kunci posisi. Rincian tersebut tidak disertakan pada JSON publik sehingga selisih sederhana antara total pegawai dan total formasi tidak akan ditampilkan sebagai “gap”.</p></div></div>`;
    return;
  }
  $('#view').innerHTML = `<div class="section-t"><h3>Proyeksi Pensiun</h3><p>Ringkasan publik tidak memuat atribut tanggal lahir atau data individual pensiun.</p></div>${emptyCard('Proyeksi pensiun tidak dipublikasikan', 'Proyeksi yang dapat ditelusuri ke pegawai tertentu memerlukan data pribadi dan tidak termasuk allowlist ekspor publik. Gunakan aplikasi lokal untuk analisis internal.', '◷')}`;
}
function renderSotk(tab) {
  if (!isReady()) { $('#view').innerHTML = needData(); return; }
  if (tab === 0) {
    $('#view').innerHTML = `<div class="section-t"><h3>SOTK Explorer</h3><p>Ringkasan master aktif dengan penyaringan ke tingkat organisasi. Rincian unit, cabang, outlet, dan jabatan tidak diterbitkan.</p></div>${levelTable()}`;
    return;
  }
  $('#view').innerHTML = `<div class="section-t"><h3>Snapshot Outlet</h3><p>Versi statis tidak menampilkan daftar cabang/outlet secara rinci.</p></div>${emptyCard('Rincian outlet tidak tersedia di versi publik', 'Tabel outlet dan struktur unit tetap berada di aplikasi lokal. Ringkasan master agregat tersedia melalui Dashboard dan SOTK Explorer.', '⌖')}`;
}
function renderIntel(tab) {
  const pages = [
    ['Vacancy Priority', 'Rincian prioritas lowongan memerlukan pencocokan posisi aktif per unit. Hasil per posisi tidak disertakan pada ekspor publik.'],
    ['Grade Mismatch', 'Analisis mismatch grade membutuhkan data jabatan dan person grade. Detail tersebut tidak dimuat di JSON publik.'],
    ['Definitive Placement', 'Pemetaan penempatan definitif memerlukan data pegawai dan unit organisasi secara individual.'],
    ['Validasi Mapping SOTK', 'Rincian kode organisasi, kode jabatan, nama posisi, dan catatan mapping hanya tersedia pada aplikasi lokal yang berizin.']
  ];
  const [title, desc] = pages[tab] || pages[0];
  $('#view').innerHTML = `<div class="section-t"><h3>${esc(title)}</h3><p>${esc(desc)}</p></div>${emptyCard('Rincian internal tidak dipublikasikan', 'Untuk menjaga kerahasiaan data SDM, versi GitHub Pages hanya memuat statistik agregat yang lolos pemeriksaan. Tidak ada baris pegawai, identitas, nama posisi, kode unit, atau rekomendasi per individu di dalam file publik.', '◉')}`;
}
function render() {
  destroyCharts();
  const item = NAV.find(x => x[0] === S.menu) || NAV[0];
  $('#crumb').textContent = 'Wilayah Jakarta 1';
  $('#ttl').textContent = item[1];
  drawNav(); drawTabs(item);
  if (isReady()) setAlert('Halaman ini hanya menyediakan ringkasan agregat baca-saja. Semua file yang dipublikasikan dapat diunduh; jangan memasukkan data yang belum diizinkan untuk publikasi.', 'info');
  else setAlert(S.loadError || (S.data && S.data.message) || 'Belum ada data yang diterbitkan. Isi halaman ini akan muncul setelah ekspor lokal yang valid dipublikasikan.', S.loadError ? 'error' : 'warn');
  if (S.menu === 'dash') renderDashboard();
  else if (S.menu === 'setup') renderSetup();
  else if (S.menu === 'mon') renderMonitoring(S.tab);
  else if (S.menu === 'mp') renderManpower(S.tab);
  else if (S.menu === 'sotk') renderSotk(S.tab);
  else if (S.menu === 'intel') renderIntel(S.tab);
}
function go(menu, tab = 0) {
  const item = NAV.find(x => x[0] === menu);
  if (!item) return;
  S.menu = menu;
  S.tab = Math.min(Math.max(0, tab), Math.max(0, (item[2] || []).length - 1));
  render();
}
async function loadPublicData() {
  const url = new URL('data/dashboard.json', document.baseURI);
  try {
    const response = await fetch(url.href, { cache: 'no-store', headers: { 'Accept': 'application/json' } });
    if (!response.ok) throw new Error(`File ringkasan publik tidak ditemukan (HTTP ${response.status}).`);
    const data = await response.json();
    if (!data || data.schema_version !== 1 || !['ready', 'not_exported'].includes(data.status)) throw new Error('Format file data/dashboard.json tidak sesuai versi yang didukung. Jalankan ulang skrip ekspor.');
    S.data = data;
  } catch (error) {
    S.loadError = error instanceof Error ? error.message : 'Terjadi kesalahan saat memuat data publik.';
  }
  render();
}

document.addEventListener('DOMContentLoaded', loadPublicData);

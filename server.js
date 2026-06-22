const express = require('express');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const CATEGORIES = ['animaux', 'nature', 'personnes'];

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lhrwtjjdyabuijssrmve.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxocnd0ampkeWFidWlqc3NybXZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMjk5NjEsImV4cCI6MjA5NzcwNTk2MX0.T_vxf0p0FNgCbGSD7QZzR7cbaBoIyepUsGmzWYFbDMw';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const DEFAULTS = {
  password: 'admin123',
  hero: { tag: "Photographe Professionnel", titleHtml: 'Nadir<br><span class="gold">Photographe</span>', desc: "Immortalisez vos moments précieux avec élégance. Mariages, portraits & événements à Oran.", bg: "hero" },
  about: { tag: "À propos", title: "Qui suis-je ?", subtitleHtml: 'Capturer l\'émotion, <span class="gold">créer des souvenirs</span>', desc1: "Basé à Oran, passionné par la photographie depuis plus de 5 ans. Chaque cliché raconte une histoire unique.", desc2: "Mariages, portraits, événements — un service sur mesure avec une qualité irréprochable.", img: "Qui suis-je.jpg", btn: "Contactez-moi", statVals: { seances: 500, clients: 300, annees: 5 }, statLabels: { seances: "Séances", clients: "Clients", annees: "Années" } },
  portfolio: { tag: "Portfolio", title: "Mes Réalisations", filters: { tous: "Tous", animaux: "Animaux", personnes: "Personnes", nature: "Nature" } },
  gallery: { animaux: [], nature: [], personnes: [] },
  services: { tag: "Services", title: "Ce que je propose", cards: [{ title: "Mariage", desc: "De la préparation à la réception, chaque instant capturé avec une sensibilité artistique." }, { title: "Portrait", desc: "Séances en studio ou extérieur. Un éclairage soigné pour révéler votre personnalité." }, { title: "Événements", desc: "Conférences, galas, fêtes — une couverture discrète et complète." }] },
  testimonials: { tag: "Témoignages", title: "Ce que disent mes clients", reviews: [{ text: "Nadir a photographié notre mariage. Chaque photo raconte une partie de notre histoire. Exceptionnel.", name: "Sarah & Ahmed", label: "Mariage, Juin 2025", img: "animaux/657868126_18076164980544811_8117737852668531970_n.jpg" }, { text: "Bluffée par le résultat ! Nadir met en valeur avec une sensibilité rare. Je recommande.", name: "Amel B.", label: "Portrait, Mars 2025", img: "personnes/655609491_18075395573544811_3104698910527199202_n.jpg" }, { text: "Notre conférence annuelle magnifiquement capturée. Professionnalisme et discrétion.", name: "Karim M.", label: "Événement, Janvier 2025", img: "personnes/631920755_18070569473544811_8718289216087484388_n.jpg" }] },
  contact: { tag: "Contact", title: "Prenons rendez-vous", formTitle: "Envoyez un message", namePh: "Votre nom *", emailPh: "Votre email *", phonePh: "Votre téléphone", msgPh: "Votre message *", submit: "Envoyer" },
  coord: { addrLabel: "Adresse", addrVal: "Oran, Algérie", phoneLabel: "Téléphone", phoneVal: "+213 555 12 34 56", emailLabel: "Email", emailVal: "contact@nadirphotographe.dz", hoursLabel: "Horaires", hoursVal: "Lun - Sam : 9h-19h", coordTitle: "Coordonnées" },
  footer: { copyrightHtml: '&copy; 2026 <span class="gold">Nadir Photographe</span>. Tous droits réservés.', designed: "Designed by" }
};

async function getContent() {
  const { data, error } = await supabase.from('content').select('data').eq('id', 1).single();
  if (error || !data) return JSON.parse(JSON.stringify(DEFAULTS));
  return { ...JSON.parse(JSON.stringify(DEFAULTS)), ...data.data };
}

async function saveContent(content) {
  await supabase.from('content').upsert({ id: 1, data: content });
}

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ---------- PUBLIC ----------
app.get('/api/ping', (req, res) => res.json({ ok: true }));

app.get('/api/content', async (req, res) => {
  const c = await getContent();
  const { password, ...pub } = c;
  res.json(pub);
});

app.get('/api/files/:category', async (req, res) => {
  const cat = req.params.category;
  if (!CATEGORIES.includes(cat)) return res.json([]);
  const { data, error } = await supabase.storage.from(cat).list('', { sortBy: { column: 'created_at', order: 'desc' } });
  if (error) return res.json([]);
  res.json((data || []).map(f => f.name));
});

app.post('/api/auth', async (req, res) => {
  const c = await getContent();
  if (req.body.password === c.password) res.json({ ok: true });
  else res.status(401).json({ ok: false, error: 'Mot de passe incorrect' });
});

// ---------- CONTACT FORM ----------
app.post('/api/contact', async (req, res) => {
  const { name, email, phone, message } = req.body;
  if (!name || !email || !message) return res.status(400).json({ ok: false, error: 'Champs requis' });
  const { error } = await supabase.from('contact_messages').insert({
    name, email, phone: phone || '', message,
    created_at: new Date().toISOString()
  });
  if (error) return res.status(500).json({ ok: false, error: error.message });
  res.json({ ok: true });
});

// ---------- AUTH MIDDLEWARE ----------
async function adminAuth(req, res, next) {
  const c = await getContent();
  const pwd = req.headers['x-admin-password'];
  if (pwd && pwd === c.password) { next(); }
  else res.status(401).json({ ok: false, error: 'Non autorisé' });
}

// ---------- ADMIN ----------
app.post('/api/content', adminAuth, async (req, res) => {
  const d = req.body.data;
  if (!d) return res.status(400).json({ ok: false, error: 'Données manquantes' });
  const current = await getContent();
  d.password = current.password;
  await saveContent(d);
  res.json({ ok: true });
});

app.post('/api/change-password', adminAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const c = await getContent();
  if (currentPassword !== c.password) return res.status(400).json({ ok: false, error: 'Mot de passe actuel incorrect' });
  if (!newPassword || newPassword.length < 4) return res.status(400).json({ ok: false, error: 'Minimum 4 caractères' });
  c.password = newPassword;
  await saveContent(c);
  res.json({ ok: true });
});

// ---------- FILE UPLOAD ----------
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

app.post('/api/upload/:category', adminAuth, upload.array('files'), async (req, res) => {
  const cat = req.params.category;
  if (!CATEGORIES.includes(cat)) return res.status(400).json({ error: 'Catégorie invalide' });
  const uploaded = [];
  for (const file of req.files) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!['.jpg','.jpeg','.png','.gif','.webp','.avif','.heic','.bmp','.tiff'].includes(ext)) continue;
    const { error } = await supabase.storage.from(cat).upload(file.originalname, file.buffer, { contentType: file.mimetype, upsert: true });
    if (!error) uploaded.push(file.originalname);
  }
  res.json({ ok: true, files: uploaded });
});

app.delete('/api/upload/:category/:filename', adminAuth, async (req, res) => {
  const { category, filename } = req.params;
  await supabase.storage.from(category).remove([filename]);
  res.json({ ok: true });
});

// ---------- STATIC HTML PAGES ----------
const HTML_FILES = ['index.html', 'admin.html'];

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/index.html', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/admin.html', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

// ---------- IMAGE REDIRECTS ----------
app.get('/:category/:filename', async (req, res) => {
  const { category, filename } = req.params;
  if (!CATEGORIES.includes(category)) return res.status(404).end();
  const { data } = supabase.storage.from(category).getPublicUrl(filename);
  if (data && data.publicUrl) return res.redirect(302, data.publicUrl);
  res.status(404).end();
});

// ---------- ROOT FILES (hero, logo, about image) ----------
// All assets are served from Supabase Storage
app.get('/:filename', (req, res) => {
  const { filename } = req.params;
  for (const cat of CATEGORIES) {
    const { data } = supabase.storage.from(cat).getPublicUrl(filename);
    if (data && data.publicUrl) return res.redirect(302, data.publicUrl);
  }
  res.status(404).end();
});

app.listen(PORT, () => {
  console.log(`Nadir Photographe — http://localhost:${PORT}`);
  console.log(`Admin — http://localhost:${PORT}/admin.html`);
});

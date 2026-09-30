// Extra one-page PDFs for the Google Drive demo, outside the analysed demo set. Run: npx tsx scripts/make-drive-pdfs.ts
// All companies, people and figures are fictional.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const OUT = join(__dirname, "..", "public/pdfs-drive");

interface Doc {
  file: string;
  title: string;
  meta: string;
  paragraphs: string[];
}

const DOCS: Doc[] = [
  {
    file: "Onboarding checklist nieuwe klant 2026.pdf",
    title: "Onboarding checklist nieuwe klant",
    meta: "Team Onboarding · versie 2026.1 · intern",
    paragraphs: [
      "Bij de opstart van een nieuwe klant controleert de consultant het paritair comite, het arbeidsreglement en de bestaande loonafspraken.",
      "Plan binnen de eerste week een kennismakingsgesprek met de HR-verantwoordelijke en leg vast wie de contactpersoon is voor loonwijzigingen.",
      "Registreer de aansluiting bij het sociaal secretariaat en controleer de Dimona-historiek van alle actieve werknemers.",
    ],
  },
  {
    file: "Verlofplanning bouwverlof 2026 - Bouwbedrijf Claes.pdf",
    title: "Verlofplanning bouwverlof 2026",
    meta: "Bouwbedrijf Claes NV · HR · 12 maart 2026",
    paragraphs: [
      "Het collectief bouwverlof loopt van maandag 20 juli tot en met vrijdag 7 augustus 2026 voor alle arbeiders van de werven in Antwerpen en Mechelen.",
      "Bedienden nemen minstens tien dagen op in dezelfde periode; afwijkingen worden aangevraagd bij de teamverantwoordelijke voor 1 juni.",
      "De loonverwerking van juli wordt daarom vervroegd afgesloten op donderdag 16 juli.",
    ],
  },
  {
    file: "Note interne - chèques-repas Ateliers Beaurieux.pdf",
    title: "Note interne : chèques-repas",
    meta: "Ateliers Beaurieux SA · Service RH · 9 février 2026",
    paragraphs: [
      "A partir du 1er mars 2026, la valeur faciale des chèques-repas passe a 10 euros par jour preste, avec une intervention patronale de 8,91 euros.",
      "L'intervention du travailleur reste fixee a 1,09 euro. Un avenant individuel est signe par chaque travailleur avant la fin du mois.",
      "Les chèques sont charges sur la carte electronique le 5 du mois suivant.",
    ],
  },
  {
    file: "Company car policy 2026 - Dijlekant IT Consulting.pdf",
    title: "Company car policy 2026",
    meta: "Dijlekant IT Consulting BV · People team · January 2026",
    paragraphs: [
      "Consultants in a client-facing role are eligible for a company car after their probation period, or for the mobility budget as an alternative.",
      "Fuel and charging costs are covered for professional and private use in Belgium; trips abroad longer than five days require prior approval.",
      "Cars are ordered through the leasing partner with a maximum lease term of 48 months.",
    ],
  },
  {
    file: "Procedure DmfA kwartaalaangifte Q1 2026.pdf",
    title: "Procedure DmfA-kwartaalaangifte",
    meta: "Kenniscentrum Payroll BE · procedure · Q1 2026",
    paragraphs: [
      "De DmfA-aangifte van het eerste kwartaal wordt ingediend voor het einde van de maand die volgt op het kwartaal.",
      "Controleer voor indiening de prestatiecodes, de bijdrageverminderingen en de aansluitingsnummers van alle klanten in de batch.",
      "Fouten die na indiening opduiken worden via een wijzigende aangifte rechtgezet, niet via een nieuwe originele aangifte.",
    ],
  },
  {
    file: "Telewerkvergoeding 2026 - Scheldezicht Engineering.pdf",
    title: "Telewerkvergoeding 2026",
    meta: "Scheldezicht Engineering NV · HR-beleid · 5 januari 2026",
    paragraphs: [
      "Werknemers die structureel minstens een dag per week van thuis werken ontvangen een maandelijkse forfaitaire telewerkvergoeding.",
      "De vergoeding dekt kosten voor verwarming, elektriciteit en klein kantoormateriaal en wordt samen met het loon uitbetaald.",
      "Aanpassingen aan het bedrag volgen de richtlijnen van de RSZ en worden in januari gecommuniceerd.",
    ],
  },
  {
    file: "Handover notes - Transport Verhaeghe.pdf",
    title: "Handover notes: Transport Verhaeghe",
    meta: "Payroll BE · handover from Nathalie Peeters · 14 September 2026",
    paragraphs: [
      "Transport Verhaeghe runs payroll twice a month for drivers and once a month for office staff. Overtime for drivers is settled with the second run.",
      "The client's HR contact prefers questions by email; urgent changes go through the planning office in Kortrijk.",
      "Open point: the joint committee for the two warehouse employees still has to be confirmed with the client.",
    ],
  },
  {
    file: "Eindejaarspremie 2025 - berekening Bakkerij Janssens.pdf",
    title: "Eindejaarspremie 2025: berekening",
    meta: "Bakkerij Janssens BV · loonverwerking · december 2025",
    paragraphs: [
      "De eindejaarspremie wordt berekend op basis van de prestaties tussen 1 december 2024 en 30 november 2025.",
      "Werknemers met een onvolledige referteperiode ontvangen een premie pro rata, volgens de sectorale regels.",
      "De premie wordt uitbetaald met het loon van december.",
    ],
  },
  {
    file: "Formation obligatoire securite 2026 - planning.pdf",
    title: "Formation obligatoire securite 2026",
    meta: "Ateliers Beaurieux SA · prevention · planning annuel",
    paragraphs: [
      "Chaque travailleur d'atelier suit une formation securite de quatre heures avant le 30 juin 2026.",
      "Les heures de formation sont considerees comme du temps de travail et remunerees comme telles.",
      "Le service prevention transmet la liste des presences au service paie apres chaque session.",
    ],
  },
  {
    file: "Ecocheques juni 2026 - overzicht klanten PC 200.pdf",
    title: "Ecocheques juni 2026: overzicht klanten PC 200",
    meta: "Payroll BE · werklijst · mei 2026",
    paragraphs: [
      "Voor alle klanten in PC 200 worden de ecocheques van 250 euro voor voltijdse bedienden in de loonrun van juni verwerkt.",
      "Deeltijdse bedienden ontvangen een bedrag volgens hun arbeidsregime; klanten met een bedrijfs-cao die de cheques omzet staan apart in de lijst.",
      "De bestelling bij de uitgever vertrekt uiterlijk op 10 juni.",
    ],
  },
  {
    file: "Exit checklist medewerker - template.pdf",
    title: "Exit checklist medewerker",
    meta: "Team Onboarding · template · 2026",
    paragraphs: [
      "Bij uitdiensttreding maakt de consultant de Dimona OUT-aangifte, het C4-formulier en de vakantieattesten aan.",
      "Het vakantiegeld bij uitdienst en het saldo van de maaltijdcheques worden met de laatste loonafrekening verrekend.",
      "De klant bevestigt schriftelijk de laatste werkdag en de reden van beeindiging.",
    ],
  },
  {
    file: "Payroll calendar 2026 - Dijlekant Nederland.pdf",
    title: "Payroll calendar 2026",
    meta: "Dijlekant Nederland B.V. · Breda · salarisadministratie",
    paragraphs: [
      "Salarissen worden uitbetaald op de 25e van elke maand; mutaties worden aangeleverd voor de 15e.",
      "De jaaropgaven worden in januari verstuurd; de loonaangifte gaat maandelijks naar de Belastingdienst.",
      "Dit document geldt alleen voor de Nederlandse vestiging.",
    ],
  },
];

const INK = rgb(0.106, 0.133, 0.188);
const GREY = rgb(0.42, 0.45, 0.5);
const RULE = rgb(0.835, 0.85, 0.878);
const WIDTH = 595.28;
const HEIGHT = 841.89;
const MARGIN = 56;

function wrap(text: string, max: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if ((line + " " + word).trim().length > max) {
      lines.push(line.trim());
      line = word;
    } else line = `${line} ${word}`;
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}

/** Standard fonts only know Latin-1; strip what they cannot draw. */
const ascii = (text: string) => text.normalize("NFD").replace(/[^\x20-\x7e\xa0-\xff]/g, "");

async function render(doc: Doc): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(doc.title);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([WIDTH, HEIGHT]);
  let y = HEIGHT - MARGIN - 10;

  page.drawText(ascii(doc.meta), { x: MARGIN, y, size: 9, font: regular, color: GREY });
  y -= 30;
  for (const line of wrap(ascii(doc.title), 42)) {
    page.drawText(line, { x: MARGIN, y, size: 22, font: bold, color: INK });
    y -= 28;
  }
  y -= 4;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: WIDTH - MARGIN, y }, thickness: 0.8, color: RULE });
  y -= 28;
  for (const paragraph of doc.paragraphs) {
    for (const line of wrap(ascii(paragraph), 88)) {
      page.drawText(line, { x: MARGIN, y, size: 11, font: regular, color: INK, lineHeight: 16 });
      y -= 16;
    }
    y -= 12;
  }
  page.drawText("Synthetic document for a hackathon demo. Names, companies and figures are fictional.", {
    x: MARGIN,
    y: MARGIN - 10,
    size: 8,
    font: regular,
    color: GREY,
  });
  return pdf.save();
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  for (const doc of DOCS) writeFileSync(join(OUT, doc.file), await render(doc));
  console.log(`${DOCS.length} PDFs written to ${OUT}`);
}

main();

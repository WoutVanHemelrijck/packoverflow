import type { Channel, Country, Lang, Person } from "../src/lib/types";

export const PEOPLE: Person[] = [
  { id: "P-01", name: "Lotte Peeters", role: "Knowledge lead, Payroll BE", team: "Knowledge Management", seniority: 4 },
  { id: "P-02", name: "Jens Maes", role: "Senior payroll consultant", team: "Payroll Ops BE", seniority: 4 },
  { id: "P-03", name: "Sophie Dubois", role: "Payroll legal expert", team: "Payroll Legal", seniority: 5 },
  { id: "P-04", name: "Karim El Amrani", role: "Payroll consultant", team: "Payroll Ops BE", seniority: 2 },
  { id: "P-05", name: "Elise Vandenberghe", role: "Client service lead", team: "Client Services Gent", seniority: 4 },
  { id: "P-06", name: "Mathieu Lambert", role: "Payroll consultant", team: "Client Services Liège", seniority: 3 },
  { id: "P-07", name: "Nadia Benali", role: "Payroll legal expert", team: "Payroll Legal", seniority: 4 },
  { id: "P-08", name: "Pieter Claes", role: "Junior payroll consultant", team: "Payroll Ops BE", seniority: 1 },
  { id: "P-09", name: "Amélie Lejeune", role: "Senior payroll consultant", team: "Client Services Brussels", seniority: 4 },
  { id: "P-10", name: "Thomas Wouters", role: "Payroll product owner", team: "Payroll Engine", seniority: 3 },
  { id: "P-11", name: "Yasmine Ouali", role: "Client service consultant", team: "Client Services Gent", seniority: 2 },
  { id: "P-12", name: "Bram De Smet", role: "Head of Payroll Legal", team: "Payroll Legal", seniority: 5 },
  { id: "P-13", name: "Chloé Martin", role: "Knowledge manager", team: "Knowledge Management", seniority: 3 },
  { id: "P-14", name: "Mehmet Yilmaz", role: "Payroll consultant", team: "Payroll Ops BE", seniority: 2 },
  { id: "P-15", name: "Laura Van Damme", role: "Team lead Payroll Ops", team: "Payroll Ops BE", seniority: 4 },
  { id: "P-16", name: "Julien Renard", role: "Client service lead", team: "Client Services Brussels", seniority: 4 },
  { id: "P-17", name: "Anouk de Vries", role: "Payroll consultant Netherlands", team: "Payroll NL", seniority: 3 },
  { id: "P-18", name: "Oksana Kovalenko", role: "Payroll data analyst", team: "Payroll Engine", seniority: 2 },
];

const person = (id: string) => PEOPLE.find((p) => p.id === id)!;
const email = (id: string) =>
  person(id).name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/ /g, ".") + "@sdworx.com";

export type TopicId =
  | "indexation-cap" | "meal-vouchers" | "home-working-allowance" | "eco-cheques" | "reintegration" | "voluntary-overtime"
  | "year-end-bonus-pc200" | "km-allowance" | "flexi-jobs" | "payroll-cutoff" | "notice-period" | "company-car-solidarity";

export type ClaimDef = [claimId: string, value: string, quote: string, appliesTo?: string];

export interface DocDef {
  key: string;
  topic: TopicId;
  title: string;
  channel: Channel;
  lang: Lang;
  country: Country;
  owner: string | null;
  author: string;
  created: string;
  updated: string;
  eff: string | null;
  path?: string;
  file?: string;
  bridge?: TopicId;
  dupOf?: string;
  body: string;
  claims: ClaimDef[];
}

interface Meta {
  owner: string | null;
  author: string;
  created?: string;
  updated: string;
  eff: string | null;
  country?: Country;
  path?: string;
  file?: string;
  bridge?: TopicId;
}

const MAILBOX = "payroll-be@sdworx.com";

function contact(lang: Lang, owner: string | null) {
  if (!owner) {
    return { nl: `Vragen? Mail naar ${MAILBOX}.`, fr: `Des questions ? Écrivez à ${MAILBOX}.`, en: `Questions: ${MAILBOX}.` }[lang];
  }
  const p = person(owner);
  return {
    nl: `Vragen? Neem contact op met ${p.name} (${p.team}) via ${email(owner)}.`,
    fr: `Des questions ? Contactez ${p.name} (${p.team}) via ${email(owner)}.`,
    en: `Questions: contact ${p.name} (${p.team}) at ${email(owner)}.`,
  }[lang];
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const longDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
};

export const DOCS: DocDef[] = [];

function add(key: string, topic: TopicId, lang: Lang, channel: Channel, title: string, m: Meta, body: string, claims: ClaimDef[]) {
  DOCS.push({
    key, topic, title, channel, lang, country: m.country ?? "BE", owner: m.owner, author: m.author,
    created: m.created ?? m.updated, updated: m.updated, eff: m.eff, path: m.path, file: m.file, bridge: m.bridge, body, claims,
  });
}

function formal(key: string, topic: TopicId, lang: Lang, channel: Channel, title: string, m: Meta, paras: string[], claims: ClaimDef[] = []) {
  const withContact = channel === "slides" ? paras : [...paras, contact(lang, m.owner)];
  add(key, topic, lang, channel, title, m, withContact.join("\n\n"), claims);
}

function mail(
  key: string, topic: TopicId, lang: Lang, subject: string,
  m: Meta & { to: string; cc?: string; time: string }, paras: string[], claims: ClaimDef[] = [],
) {
  const from = person(m.author);
  const to = m.to === "shared" ? `Payroll BE shared mailbox <${MAILBOX}>` : `${person(m.to).name} <${email(m.to)}>`;
  const head = [
    `From: ${from.name} <${email(m.author)}>`,
    `To: ${to}`,
    ...(m.cc ? [`Cc: ${person(m.cc).name} <${email(m.cc)}>`] : []),
    `Subject: ${subject}`,
    `Date: ${longDate(m.updated)} ${m.time}`,
  ].join("\n");
  add(key, topic, lang, "email", subject, m, [head, ...paras].join("\n\n"), claims);
}

function chat(
  key: string, topic: TopicId, lang: Lang, title: string, m: Meta & { channelName: string },
  lines: [time: string, who: string, text: string][], claims: ClaimDef[] = [],
) {
  const head = `Microsoft Teams chat export\nChannel: ${m.channelName}\nDate: ${longDate(m.updated)}`;
  const log = lines.map(([t, who, text]) => `[${t}] ${person(who).name}: ${text}`).join("\n");
  add(key, topic, lang, "teams", title, m, `${head}\n\n${log}`, claims);
}

function dup(key: string, of: string, m: { owner: string | null; author: string; updated: string; file: string }, edit: (body: string) => string) {
  const orig = DOCS.find((d) => d.key === of)!;
  DOCS.push({
    ...orig, key, dupOf: of, owner: m.owner, author: m.author, created: m.updated, updated: m.updated, file: m.file,
    body: edit(orig.body), claims: [],
  });
}

// ---------------- Indexation cap 2026 (hero) ----------------

formal("idx_faq", "indexation-cap", "nl", "faq", "Indexering 2026 - FAQ klanten",
  { owner: null, author: "P-11", created: "2025-11-20", updated: "2025-12-04", eff: "2026-01-01" }, [
    "Deze FAQ beantwoordt de vragen die klanten stellen over het indexeringsplafond dat de federale regering voor 2026 heeft aangekondigd. De tekst is bedoeld voor klantenadviseurs van Client Services Gent en Brussel.",
    "Vanaf wanneer geldt het plafond? Het indexeringsplafond geldt vanaf 1 januari 2026 voor alle werknemers in de privésector.",
    "Op welk loon? De indexering wordt alleen toegepast op het deel van het bruto maandloon tot EUR 4.000. Het deel boven EUR 4.000 wordt niet geïndexeerd.",
    "Rekenvoorbeeld: een bediende in PC 200 verdient EUR 4.800 bruto per maand. Bij een indexering van 2,00% stijgt enkel het deel tot EUR 4.000: 2,00% x EUR 4.000 = EUR 80,00. Het nieuwe brutoloon wordt EUR 4.880,00 in plaats van EUR 4.896,00 zonder plafond.",
    "Geldt het plafond ook voor PC 118 en PC 124? Ja. Het plafond volgt uit de wet en geldt voor alle paritaire comités. Het moment waarop het loon effectief verhoogd wordt, hangt af van het indexeringsmechanisme van elk paritair comité.",
  ], [
    ["indexation_cap.start_date", "1 January 2026", "Het indexeringsplafond geldt vanaf 1 januari 2026"],
    ["indexation_cap.threshold", "€4,000.00", "het deel van het bruto maandloon tot EUR 4.000"],
  ]);

formal("idx_policy", "indexation-cap", "en", "policy", "Indexation cap policy 2026",
  { owner: "P-12", author: "P-03", created: "2025-10-02", updated: "2026-09-23", eff: "2026-06-01" }, [
    "Purpose. This policy sets how SD Worx Payroll BE applies the indexation cap introduced by the 2026 federal budget agreement. It replaces the interim guidance of December 2025 and all client FAQs that predate it.",
    "Scope. The policy covers all Belgian private-sector employers serviced by Payroll BE, in all joint committees. It does not apply to payrolls run under Dutch or Luxembourg law.",
    "Rule. The indexation cap applies from 1 June 2026. From that date, automatic wage indexation applies in full to the part of gross monthly pay up to EUR 4,000 and does not apply to the part of gross monthly pay above EUR 4,000.",
    "Worked example. An employee earns EUR 4,800 gross per month and the joint committee applies an indexation of 2.00%. The indexed part is EUR 4,000 x 2.00% = EUR 80.00. The part above the cap, EUR 800, stays unchanged. New gross monthly pay: EUR 4,880.00. Without the cap it would have been EUR 4,896.00, so the cap reduces the increase by EUR 16.00.",
    "Timing. The moment of the first indexation under the cap depends on the indexation mechanism of each joint committee. Payroll Ops BE maintains the calendar per joint committee in the procedures library.",
  ], [
    ["indexation_cap.start_date", "1 June 2026", "The indexation cap applies from 1 June 2026"],
    ["indexation_cap.threshold", "€4,000.00", "the part of gross monthly pay above EUR 4,000"],
  ]);

formal("idx_nl", "indexation-cap", "en", "policy", "Indexation cap policy 2026",
  { owner: "P-17", author: "P-17", created: "2025-12-10", updated: "2026-05-14", eff: "2026-01-01", country: "NL",
    path: "SharePoint / Payroll NL / Policies", file: "Indexation cap policy 2026 - NL.pdf" }, [
    "Purpose. This policy describes the indexation cap for payrolls run by SD Worx Netherlands under the 2026 collective agreements for Dutch clients. It is maintained by Payroll NL.",
    "Scope. Dutch employers only. Belgian payrolls follow the Payroll BE policy with the same title.",
    "Rule. The indexation cap applies from 1 January 2026. Collective wage increases apply in full to the part of gross monthly pay up to EUR 4,500; the part above EUR 4,500 follows the individual contract.",
    "Worked example. Gross monthly pay EUR 5,000 and a collective increase of 3.00%. Increase on the capped part: EUR 4,500 x 3.00% = EUR 135.00. New gross monthly pay: EUR 5,135.00.",
  ], [
    ["indexation_cap.start_date", "1 January 2026", "The indexation cap applies from 1 January 2026"],
    ["indexation_cap.threshold", "€4,500.00", "the part of gross monthly pay up to EUR 4,500"],
  ]);

mail("idx_email", "indexation-cap", "nl", "RE: indexeringsplafond PC 200",
  { owner: "P-02", author: "P-02", updated: "2026-07-08", eff: null, to: "P-01", cc: "P-05", time: "10:14",
    file: "RE indexeringsplafond PC 200.pdf" }, [
    "Hoi Lotte,",
    "Ik heb het nagevraagd bij een klant in PC 200. Volgens hun boekhouder begint het plafond op 1 juli 2026, omdat de wet pas eind juni gepubliceerd werd. Ik zou de klanten dus 1 juli meegeven.",
    "Voorbeeld dat ik gebruikte: bruto EUR 4.800, index 2,00%, dan EUR 80,00 extra in plaats van EUR 96,00.",
    "Groetjes,\nJens",
    "> Van: Lotte Peeters\n> Weten we al vanaf wanneer het indexeringsplafond geldt? Ik krijg vragen van Transport Verhaeghe.",
  ], [["indexation_cap.start_date", "1 July 2026", "begint het plafond op 1 juli 2026"]]);

formal("idx_procA", "indexation-cap", "nl", "procedure", "Procedure indexering PC 200 - toepassing plafond",
  { owner: "P-15", author: "P-14", created: "2026-05-20", updated: "2026-06-10", eff: "2026-06-01" }, [
    "Doel. Deze procedure beschrijft hoe Payroll Ops BE het indexeringsplafond verwerkt in de loonmotor voor klanten in PC 200 (aanvullend paritair comité voor de bedienden).",
    "Toepassing. Het plafond wordt voor PC 200 voor het eerst toegepast bij de indexering van juni 2026, samen met de inwerkingtreding van het plafond op 1 juni 2026.",
    "Stappen. 1. Controleer in de loonmotor of de parameter INDEX_CAP_BE op EUR 4.000 staat. 2. Start de simulatie voor alle PC 200-dossiers. 3. Vergelijk het bruto maandloon voor en na indexering en markeer verschillen groter dan EUR 20,00 voor controle.",
    "Voorbeeld: bruto EUR 5.200, indexering 2,00%. Geïndexeerd deel EUR 4.000 x 2,00% = EUR 80,00. Nieuw brutoloon EUR 5.280,00.",
  ], [["indexation_cap.first_application_pc200", "June 2026 indexation", "voor het eerst toegepast bij de indexering van juni 2026", "PC 200"]]);

formal("idx_procB", "indexation-cap", "fr", "procedure", "Procédure plafond d'indexation CP 200",
  { owner: "P-16", author: "P-09", created: "2026-05-28", updated: "2026-06-18", eff: "2026-06-01",
    path: "SharePoint / Client Services Brussels / Procédures" }, [
    "Objet. Cette procédure décrit l'application du plafond d'indexation pour les clients de la commission paritaire 200 suivis par Client Services Brussels.",
    "Application. Le plafond est en vigueur depuis le 1er juin 2026. Pour la CP 200, il s'applique pour la première fois à l'indexation de janvier 2027, parce que la CP 200 indexe les salaires une fois par an, en janvier.",
    "Exemple. Salaire brut mensuel EUR 4.600 en décembre 2026, indexation de janvier 2027 de 2,20 %. Partie indexée : EUR 4.000 x 2,20 % = EUR 88,00. Nouveau salaire brut : EUR 4.688,00.",
    "Communication client. Informez les clients CP 200 qu'aucune adaptation n'est requise en juin 2026. Les clients des CP 118 et CP 124 suivent leur propre calendrier d'indexation.",
  ], [["indexation_cap.first_application_pc200", "January 2027 indexation", "il s'applique pour la première fois à l'indexation de janvier 2027", "PC 200"]]);

formal("idx_slides", "indexation-cap", "en", "slides", "Indexation cap 2026 - client briefing",
  { owner: "P-05", author: "P-05", created: "2026-08-25", updated: "2026-09-02", eff: "2026-06-01" }, [
    "Slide 1. Indexation cap 2026: what changes for your payroll",
    "Slide 2. The cap is in force from 1 June 2026. Indexation applies to gross monthly pay up to EUR 4,000.",
    "Slide 3. Example: EUR 4,800 gross, 2.00% indexation, increase EUR 80.00 instead of EUR 96.00.",
    "Slide 4. Timing per joint committee: PC 200 indexes in January, PC 118 and PC 124 follow their own schedule. Check the procedure of your team before you promise a date to a client.",
    "Slide 5. Questions: Elise Vandenberghe, Client Services Gent.",
  ]);

chat("idx_teams", "indexation-cap", "nl", "Teams export - Payroll Ops BE - indexering",
  { owner: "P-15", author: "P-04", updated: "2026-09-15", eff: null, channelName: "Payroll Ops BE / indexering" }, [
    ["09:12", "P-04", "Transport Verhaeghe vraagt of het indexeringsplafond al in hun loonstrook van september zit. Dat is PC 140, toch?"],
    ["09:14", "P-15", "Ja, PC 140. Die volgen hun eigen indexering. Het plafond is wel van kracht sinds 1 juni."],
    ["09:15", "P-04", "En de parameter staat op EUR 4.000?"],
    ["09:17", "P-15", "Klopt. Zie de policy van Payroll Legal, vorige week nog bijgewerkt."],
    ["09:18", "P-04", "Top, dank je."],
  ]);

formal("idx_faqfr", "indexation-cap", "fr", "faq", "FAQ plafond d'indexation 2026",
  { owner: "P-13", author: "P-13", created: "2026-06-05", updated: "2026-06-22", eff: "2026-06-01",
    path: "Confluence / PAYBE / FAQ clients FR" }, [
    "Cette FAQ reprend les questions fréquentes des clients francophones sur le plafond d'indexation.",
    "Quel salaire est concerné ? L'indexation s'applique au salaire brut mensuel jusqu'à EUR 4.000. La partie au-delà n'est pas indexée.",
    "Exemple : salaire brut EUR 4.300, indexation 2,00 %. Augmentation : EUR 4.000 x 2,00 % = EUR 80,00. Nouveau salaire : EUR 4.380,00.",
    "Les primes et avantages en nature sont-ils concernés ? Non, le plafond vise uniquement le salaire mensuel de base.",
  ]);

dup("idx_faq_dup", "idx_faq", { owner: null, author: "P-04", updated: "2026-01-12", file: "Indexering 2026 - FAQ klanten (1).pdf" },
  (b) => b.replace("Deze FAQ beantwoordt", "Deze FAQ (kopie) beantwoordt") + "\n\nOpgeslagen als kopie voor intern gebruik.");

formal("idx_bridge", "indexation-cap", "nl", "procedure", "Indexering en eindejaarspremie PC 200 - rekenvoorbeeld",
  { owner: "P-15", author: "P-08", created: "2026-08-30", updated: "2026-09-04", eff: "2026-06-01", bridge: "year-end-bonus-pc200" }, [
    "Doel. Deze nota toont hoe het indexeringsplafond doorwerkt in de eindejaarspremie voor bedienden in PC 200.",
    "De eindejaarspremie in PC 200 is gelijk aan het bruto maandloon van december. Omdat het plafond de indexering van het maandloon beperkt, beperkt het ook de premie.",
    "Rekenvoorbeeld: bruto maandloon EUR 4.800 in 2026. Na de indexering van januari 2027 (2,20%) wordt het EUR 4.888,00 (EUR 4.000 x 2,20% = EUR 88,00). De eindejaarspremie van december 2027 bedraagt dan EUR 4.888,00 in plaats van EUR 4.905,60 zonder plafond, een verschil van EUR 17,60.",
  ]);

// ---------------- Meal vouchers ----------------

formal("mv_policy", "meal-vouchers", "nl", "policy", "Maaltijdcheques beleid 2026",
  { owner: "P-15", author: "P-02", created: "2023-12-05", updated: "2026-01-08", eff: "2026-01-01" }, [
    "Doel. Dit beleid legt de regels vast voor de toekenning van maaltijdcheques door klanten van SD Worx Payroll BE vanaf 1 januari 2026.",
    "Toepassingsgebied. Alle Belgische werkgevers die maaltijdcheques toekennen via een elektronische uitgever, in alle paritaire comités.",
    "Regel. De maximale nominale waarde van een maaltijdcheque bedraagt EUR 10,00 per gewerkte dag. De werknemer betaalt minimaal EUR 1,09 per cheque; de werkgeversbijdrage bedraagt maximaal EUR 8,91.",
    "Rekenvoorbeeld. Een voltijdse bediende werkt 20 dagen in maart 2026. Nominale waarde: 20 x EUR 10,00 = EUR 200,00. Werknemersbijdrage: 20 x EUR 1,09 = EUR 21,80, ingehouden op het nettoloon. Werkgeversbijdrage: 20 x EUR 8,91 = EUR 178,20.",
    "Maaltijdcheques worden enkel toegekend voor effectief gewerkte dagen. Dagen ziekte, vakantie en klein verlet geven geen recht op een cheque.",
  ], [
    ["meal_vouchers.max_face_value", "€10.00", "De maximale nominale waarde van een maaltijdcheque bedraagt EUR 10,00"],
    ["meal_vouchers.employee_contribution", "€1.09", "De werknemer betaalt minimaal EUR 1,09 per cheque"],
  ]);

formal("mv_slides", "meal-vouchers", "fr", "slides", "Titres-repas 2024 - formation clients",
  { owner: "P-06", author: "P-06", created: "2024-02-20", updated: "2024-03-12", eff: "2024-01-01" }, [
    "Slide 1. Titres-repas : règles 2024 pour nos clients",
    "Slide 2. Valeur faciale maximale : EUR 8,00 par jour presté. Intervention minimale du travailleur : EUR 1,09.",
    "Slide 3. Exemple : 21 jours prestés x EUR 8,00 = EUR 168,00. Part travailleur : 21 x EUR 1,09 = EUR 22,89. Part employeur : EUR 145,11.",
    "Slide 4. Pas de titre-repas pour les jours de maladie ou de congé.",
    "Slide 5. Contact : Mathieu Lambert, Client Services Liège.",
  ], [["meal_vouchers.max_face_value", "€8.00", "Valeur faciale maximale : EUR 8,00 par jour presté"]]);

chat("mv_teams", "meal-vouchers", "nl", "Teams export - Client Services Gent - maaltijdcheques",
  { owner: "P-05", author: "P-11", updated: "2025-11-18", eff: null, channelName: "Client Services Gent / algemeen" }, [
    ["10:02", "P-11", "Bakkerij Janssens vraagt of ze de maaltijdcheques mogen optrekken. Wat is het maximum nu?"],
    ["10:05", "P-05", "Het maximum is EUR 8,00 per dag, daar verandert niets aan."],
    ["10:06", "P-11", "Ook niet volgend jaar?"],
    ["10:09", "P-05", "Niet dat ik weet. Ik laat het weten als Payroll Legal iets publiceert."],
    ["10:10", "P-11", "Ok, bedankt!"],
  ], [["meal_vouchers.max_face_value", "€8.00", "Het maximum is EUR 8,00 per dag"]]);

formal("mv_faq", "meal-vouchers", "fr", "faq", "FAQ titres-repas 2026",
  { owner: "P-13", author: "P-09", created: "2026-01-05", updated: "2026-01-15", eff: "2026-01-01",
    path: "Confluence / PAYBE / FAQ clients FR" }, [
    "Cette FAQ répond aux questions des clients sur les titres-repas à partir du 1er janvier 2026.",
    "Quelle est la part du travailleur ? Le travailleur paie au minimum EUR 1,09 par titre-repas. Cette part est retenue sur le salaire net.",
    "Un travailleur à temps partiel reçoit-il des titres-repas ? Oui, un titre par jour presté, quel que soit le nombre d'heures ce jour-là, sauf si l'entreprise applique une formule en heures.",
    "Exemple : 15 jours prestés en février 2026. Retenue travailleur : 15 x EUR 1,09 = EUR 16,35.",
  ], [["meal_vouchers.employee_contribution", "€1.09", "Le travailleur paie au minimum EUR 1,09 par titre-repas"]]);

formal("mv_proc", "meal-vouchers", "en", "procedure", "Meal voucher order file - monthly procedure",
  { owner: "P-15", author: "P-18", created: "2025-01-10", updated: "2026-02-02", eff: "2026-01-01" }, [
    "Purpose. This procedure describes how Payroll Ops BE produces the monthly meal voucher order file for the electronic voucher issuers.",
    "Steps. 1. After payroll close, export the worked-days report per employee. 2. Check that absence codes for sickness and leave are excluded. 3. Generate the order file in the issuer format and upload it before the 5th working day of the next month.",
    "Example. Brasserie du Parc SRL, 12 employees, 238 worked days in total in March 2026. The order file contains 238 vouchers with a total face value of EUR 2,380.00, of which EUR 259.42 is deducted from employees and EUR 2,120.58 is paid by the employer.",
    "Corrections after upload go through the issuer portal. Log each correction in the payroll ticket.",
  ]);

mail("mv_email", "meal-vouchers", "nl", "Maaltijdcheques bij ziekte - Bakkerij Janssens BV",
  { owner: "P-11", author: "P-11", updated: "2026-03-04", eff: null, to: "P-02", time: "14:37" }, [
    "Dag Jens,",
    "Bakkerij Janssens BV (PC 118) vraagt of een werknemer die halve dagen werkt na ziekte recht heeft op een maaltijdcheque. Het gaat over een deeltijdse werkhervatting met toelating van de adviserend arts.",
    "Mijn voorstel: een cheque per dag waarop effectief gewerkt wordt, ook als het een halve dag is. Voor 8 halve dagen in april is dat 8 x EUR 10,00 = EUR 80,00 nominaal.",
    "Kan jij dit bevestigen voor ik antwoord?\n\nGroeten,\nYasmine",
  ]);

dup("mv_dup", "mv_policy", { owner: null, author: "P-08", updated: "2026-01-19", file: "Maaltijdcheques beleid 2026 v2 FINAL.pdf" },
  (b) => b.replace("Doel. Dit beleid", "Doel. Deze versie van het beleid") + "\n\nVersie 2 FINAL, nagelezen door Payroll Ops.");

formal("mv_faq_nl", "meal-vouchers", "nl", "faq", "Maaltijdcheques en deeltijdse werknemers",
  { owner: null, author: "P-08", created: "2025-06-02", updated: "2025-06-12", eff: "2025-06-01" }, [
    "Deze pagina legt uit hoe maaltijdcheques berekend worden voor deeltijdse werknemers.",
    "Regel. Het aantal cheques is gelijk aan het aantal dagen waarop de werknemer effectief gewerkt heeft. Werkt de onderneming met een urenformule, dan deel je het aantal gewerkte uren door de normale dagduur van een voltijdse werknemer.",
    "Voorbeeld: 76 gewerkte uren, voltijdse dagduur 7,6 uur. Aantal cheques: 76 / 7,6 = 10.",
  ]);

formal("mv_lu", "meal-vouchers", "fr", "policy", "Chèques-repas Luxembourg 2026",
  { owner: "P-06", author: "P-06", created: "2026-01-02", updated: "2026-01-20", eff: "2026-01-01", country: "LU",
    path: "SharePoint / Payroll LU / Politiques" }, [
    "Objet. Cette politique s'applique aux employeurs luxembourgeois clients de SD Worx Luxembourg.",
    "Règle. La valeur faciale du chèque-repas est de EUR 15,00, dont une part travailleur de EUR 2,80.",
    "Exemple : 20 jours x EUR 15,00 = EUR 300,00, dont EUR 56,00 à charge du travailleur et EUR 244,00 à charge de l'employeur.",
  ], [["meal_vouchers.max_face_value", "€15.00", "La valeur faciale du chèque-repas est de EUR 15,00"]]);

// ---------------- Home working allowance ----------------

formal("hw_procA", "home-working-allowance", "nl", "procedure", "Procedure thuiswerkvergoeding 2026",
  { owner: "P-15", author: "P-08", created: "2026-03-25", updated: "2026-04-03", eff: "2026-04-01" }, [
    "Doel. Deze procedure beschrijft hoe Payroll Ops BE de forfaitaire thuiswerkvergoeding verwerkt na de indexering van april 2026.",
    "Regel. De maximale forfaitaire thuiswerkvergoeding bedraagt EUR 157,83 per maand vanaf 1 april 2026. De vergoeding is vrij van RSZ en bedrijfsvoorheffing zolang het maximum niet overschreden wordt.",
    "Rekenvoorbeeld. Een bediende werkt structureel twee dagen per week thuis en krijgt het maximum. Op jaarbasis: 12 x EUR 157,83 = EUR 1.893,96, volledig vrijgesteld.",
    "Stappen: pas looncode 3120 aan in de loonmotor voor alle klanten met een thuiswerkbeleid en controleer de simulatie van april.",
  ], [["home_working.max_allowance", "€157.83", "De maximale forfaitaire thuiswerkvergoeding bedraagt EUR 157,83 per maand"]]);

formal("hw_procB", "home-working-allowance", "fr", "procedure", "Procédure indemnité de télétravail 2026",
  { owner: "P-16", author: "P-06", created: "2026-04-02", updated: "2026-04-20", eff: "2026-04-01",
    path: "SharePoint / Client Services Liège / Procédures" }, [
    "Objet. Cette procédure explique le traitement de l'indemnité forfaitaire de télétravail pour les clients suivis à Liège.",
    "Règle. Le montant maximal de l'indemnité de bureau est de EUR 154,74 par mois à partir du 1er avril 2026. Au-delà, le surplus est soumis aux cotisations sociales.",
    "Exemple : 12 x EUR 154,74 = EUR 1.856,88 par an sans cotisations.",
    "Adaptez le code salarial 3120 dans le moteur de paie avant la clôture d'avril.",
  ], [["home_working.max_allowance", "€154.74", "Le montant maximal de l'indemnité de bureau est de EUR 154,74 par mois"]]);

formal("hw_policy", "home-working-allowance", "en", "policy", "Home working policy for clients",
  { owner: "P-12", author: "P-07", created: "2024-09-12", updated: "2025-10-15", eff: "2025-10-01" }, [
    "Purpose. This policy sets the conditions under which SD Worx Payroll BE clients may pay a tax-free home working allowance.",
    "Conditions. The employee works from home structurally, at least one day per week on average, under a written home working agreement. The allowance covers heating, electricity, office supplies and small equipment.",
    "Amounts are indexed. Payroll Ops BE publishes the current maximum in the procedure library after each indexation. Clients can combine the allowance with an internet allowance of EUR 20 per month and a PC allowance of EUR 20 per month.",
    "Example. EUR 150.00 home working allowance, EUR 20.00 internet and EUR 20.00 PC: total EUR 190.00 per month, all tax-free.",
  ]);

formal("hw_faq", "home-working-allowance", "nl", "faq", "Thuiswerk FAQ",
  { owner: null, author: "P-04", created: "2024-02-14", updated: "2025-03-10", eff: "2025-03-01" }, [
    "Mag een werknemer die maar een dag per maand thuiswerkt een thuiswerkvergoeding krijgen? Nee, de RSZ verwacht structureel thuiswerk, gemiddeld minstens een dag per week.",
    "Mag de vergoeding pro rata voor deeltijdsen? Ja, maar het is niet verplicht. De vergoeding mag niet hoger zijn dan het maximum voor voltijdsen.",
    "Voorbeeld: een deeltijdse werknemer op 60% met een pro rata vergoeding op een maandbedrag van EUR 150,00 krijgt EUR 90,00.",
  ]);

chat("hw_teams", "home-working-allowance", "fr", "Teams export - Client Services Liège - télétravail",
  { owner: "P-06", author: "P-06", updated: "2026-04-22", eff: null, channelName: "Client Services Liège / général" }, [
    ["11:30", "P-06", "J'ai mis à jour la procédure télétravail pour avril. Brasserie du Parc demande si le montant change encore cette année."],
    ["11:34", "P-09", "Normalement pas avant la prochaine indexation. Tu as vérifié le montant avec Payroll Ops à Gand ?"],
    ["11:36", "P-06", "Pas encore, je leur envoie un message."],
    ["11:40", "P-09", "Merci, les clients comparent nos chiffres entre Gand et Liège."],
  ]);

dup("hw_dup", "hw_procA", { owner: "P-15", author: "P-14", updated: "2026-04-07", file: "Procedure thuiswerkvergoeding 2026 - copy.pdf" },
  (b) => b.replace("Stappen: pas", "Stappen: pas vóór de afsluiting") );

formal("hw_nl", "home-working-allowance", "nl", "policy", "Thuiswerkvergoeding Nederland 2026",
  { owner: "P-17", author: "P-17", created: "2025-12-18", updated: "2026-01-09", eff: "2026-01-01", country: "NL",
    path: "SharePoint / Payroll NL / Beleid" }, [
    "Doel. Dit beleid geldt voor Nederlandse werkgevers die via SD Worx Nederland verlonen.",
    "Regel. De onbelaste thuiswerkvergoeding bedraagt EUR 2,45 per thuiswerkdag in 2026.",
    "Voorbeeld: 9 thuiswerkdagen in een maand x EUR 2,45 = EUR 22,05 onbelast.",
  ]);

formal("hw_slides", "home-working-allowance", "en", "slides", "Home working - client training 2024",
  { owner: "P-05", author: "P-05", created: "2024-09-02", updated: "2024-09-10", eff: "2024-09-01" }, [
    "Slide 1. Home working and allowances: what can be paid tax-free?",
    "Slide 2. Structural home working: at least one day per week, with a written agreement.",
    "Slide 3. Allowances in 2024: office allowance, internet EUR 20 per month, PC EUR 20 per month.",
    "Slide 4. Example: EUR 148.73 + EUR 20.00 + EUR 20.00 = EUR 188.73 per month.",
    "Slide 5. Questions: Client Services Gent.",
  ]);

// ---------------- Eco-cheques ----------------

formal("eco_policy", "eco-cheques", "nl", "policy", "Ecocheques beleid PC 200",
  { owner: "P-15", author: "P-02", created: "2024-11-04", updated: "2026-01-12", eff: "2026-01-01" }, [
    "Doel. Dit beleid legt vast hoe klanten in PC 200 ecocheques toekennen.",
    "Regel. Een voltijdse bediende met een volledige referteperiode ontvangt ecocheques voor een bedrag van EUR 250,00 per jaar. De referteperiode loopt van 1 december tot en met 30 november.",
    "Uitbetaling. De cheques worden uiterlijk op 15 december uitgereikt, via de elektronische uitgever van de klant.",
    "Rekenvoorbeeld. Een bediende treedt in dienst op 1 juni 2026. Gewerkte en gelijkgestelde maanden in de referteperiode: 6 van 12. Bedrag: EUR 250,00 x 6 / 12 = EUR 125,00.",
  ], [["eco_cheques.max_amount", "€250.00", "ecocheques voor een bedrag van EUR 250,00 per jaar"]]);

formal("eco_faqA", "eco-cheques", "nl", "faq", "FAQ ecocheques deeltijdsen",
  { owner: "P-13", author: "P-13", created: "2026-01-20", updated: "2026-02-03", eff: "2026-01-01" }, [
    "Deze FAQ behandelt ecocheques voor deeltijdse bedienden in PC 200.",
    "Hoeveel ecocheques krijgt een deeltijdse werknemer? Een deeltijdse werknemer ontvangt ecocheques pro rata van zijn arbeidsduur.",
    "Voorbeeld: een bediende werkt het hele jaar 4/5. Bedrag: EUR 250,00 x 80% = EUR 200,00.",
    "Een voltijdse bediende met een volledige referteperiode krijgt het maximum van EUR 250,00.",
  ], [
    ["eco_cheques.part_time", "Pro rata of working time", "ontvangt ecocheques pro rata van zijn arbeidsduur", "PC 200"],
    ["eco_cheques.max_amount", "€250.00", "het maximum van EUR 250,00"],
  ]);

formal("eco_faqB", "eco-cheques", "fr", "faq", "FAQ éco-chèques temps partiel",
  { owner: "P-09", author: "P-09", created: "2026-01-28", updated: "2026-02-11", eff: "2026-01-01",
    path: "Confluence / PAYBE / FAQ clients FR" }, [
    "Cette FAQ traite des éco-chèques pour les employés à temps partiel de la CP 200.",
    "Un travailleur à temps partiel reçoit-il moins ? Non, dans la CP 200 le travailleur à temps partiel reçoit le montant complet de EUR 250,00, comme un temps plein.",
    "Exemple : une employée à mi-temps présente toute l'année reçoit EUR 250,00 en éco-chèques.",
    "Les périodes de maladie couvertes par le salaire garanti sont assimilées à du travail.",
  ], [["eco_cheques.part_time", "Full amount", "le travailleur à temps partiel reçoit le montant complet de EUR 250,00", "PC 200"]]);

formal("eco_legal", "eco-cheques", "nl", "legal", "Ecocheques - cao nr. 98",
  { owner: "P-12", author: "P-07", created: "2023-04-18", updated: "2026-01-05", eff: "2026-01-01" }, [
    "Samenvatting van de collectieve arbeidsovereenkomst nr. 98 over ecocheques, zoals gewijzigd, en van de sectorale afspraken in PC 200.",
    "Artikel 3. Het totale bedrag van de ecocheques mag per werknemer en per kalenderjaar niet hoger liggen dan EUR 250,00.",
    "Artikel 4. De geldigheidsduur van een ecocheque bedraagt 24 maanden vanaf de uitgifte. De cheque vermeldt de vervaldatum.",
    "Artikel 5. Ecocheques zijn vrij van sociale bijdragen en belastingen als alle voorwaarden van deze overeenkomst vervuld zijn.",
  ], [["eco_cheques.max_amount", "€250.00", "niet hoger liggen dan EUR 250,00"]]);

mail("eco_email", "eco-cheques", "fr", "Éco-chèques Clinique Saint-Luc",
  { owner: "P-09", author: "P-09", updated: "2026-06-03", eff: null, to: "P-06", time: "09:21", file: "Eco-cheques Clinique Saint-Luc.pdf" }, [
    "Bonjour Mathieu,",
    "La Clinique Saint-Luc ASBL (CP 330) demande si elle peut remplacer les éco-chèques par une prime nette. Dans la CP 330 les éco-chèques ne sont pas imposés par le secteur, c'est une décision de l'employeur.",
    "Je leur propose de garder les éco-chèques : EUR 250,00 par travailleur temps plein, sans cotisations, contre environ EUR 139,00 net pour une prime brute de EUR 250,00.",
    "Bonne journée,\nAmélie",
  ]);

chat("eco_teams", "eco-cheques", "nl", "Teams export - Payroll Ops BE - ecocheques",
  { owner: "P-15", author: "P-14", updated: "2026-09-18", eff: null, channelName: "Payroll Ops BE / vragen" }, [
    ["15:40", "P-14", "Wanneer moeten de ecocheques voor PC 200 in het bestand van de uitgever zitten?"],
    ["15:42", "P-15", "Uiterlijk 15 december uitreiken, dus bestand klaar tegen 5 december."],
    ["15:43", "P-14", "En voor deeltijdsen, pro rata of volledig bedrag? Ik zie twee FAQ's die elkaar tegenspreken."],
    ["15:47", "P-15", "Goeie vraag. Ik vraag het na bij Lotte."],
  ]);

formal("eco_slides", "eco-cheques", "en", "slides", "Eco-cheques 2024 - payroll engine setup",
  { owner: null, author: "P-10", created: "2024-11-12", updated: "2024-11-20", eff: "2024-12-01" }, [
    "Slide 1. Eco-cheques in the payroll engine",
    "Slide 2. Wage code 7500 holds the eco-cheque amount per employee. The amount is not part of gross taxable pay.",
    "Slide 3. Reference period PC 200: 1 December to 30 November. Payment by 15 December.",
    "Slide 4. Example: 14 employees x EUR 250.00 = EUR 3,500.00 ordered from the issuer.",
    "Slide 5. Owner: Payroll Engine team.",
  ]);

// ---------------- Reintegration (2026 sick-leave reform) ----------------

formal("re_old", "reintegration", "nl", "policy", "Re-integratiebeleid 2025",
  { owner: "P-12", author: "P-07", created: "2024-11-05", updated: "2025-01-20", eff: "2025-01-01" }, [
    "Doel. Dit beleid beschrijft hoe klanten een re-integratietraject opstarten voor werknemers die langdurig arbeidsongeschikt zijn.",
    "Termijn. De werkgever bezorgt een re-integratieplan binnen 10 weken nadat de preventieadviseur-arbeidsarts de re-integratiebeoordeling heeft afgerond.",
    "Voorbeeld: beoordeling afgerond op 3 maart 2025, plan uiterlijk op 12 mei 2025.",
    "Het plan wordt opgesteld in overleg met de werknemer en vermeldt de aangepaste taken, uren en opleidingen.",
  ], [["reintegration.plan_deadline", "10 weeks", "een re-integratieplan binnen 10 weken"]]);

formal("re_new", "reintegration", "fr", "policy", "Politique de réintégration 2026",
  { owner: "P-12", author: "P-03", created: "2025-12-01", updated: "2026-01-14", eff: "2026-01-01",
    path: "SharePoint / Payroll BE / Politiques" }, [
    "Objet. Cette politique remplace la politique de réintégration 2025 et intègre la réforme 2026 de l'incapacité de travail.",
    "Délai. L'employeur remet un plan de réintégration dans les 8 semaines après l'évaluation de réintégration par le conseiller en prévention-médecin du travail.",
    "Exemple : évaluation clôturée le 2 février 2026, plan au plus tard le 30 mars 2026.",
    "Nouveau en 2026 : le travailleur peut demander lui-même un trajet dès le troisième mois d'incapacité, et l'employeur doit répondre dans un délai de 2 semaines.",
  ], [["reintegration.plan_deadline", "8 weeks", "un plan de réintégration dans les 8 semaines"]]);

formal("re_procA", "reintegration", "nl", "procedure", "Procedure werkgeversbijdrage arbeidsongeschiktheid",
  { owner: "P-15", author: "P-02", created: "2026-06-15", updated: "2026-07-02", eff: "2026-07-01" }, [
    "Doel. Vanaf 1 juli 2026 betalen werkgevers een bijdrage in de ziekte-uitkering tijdens de tweede en derde maand arbeidsongeschiktheid. Deze procedure beschrijft de verwerking.",
    "Regel. De werkgever betaalt een bijdrage van 30% van de ziekte-uitkering tijdens de tweede en derde maand van arbeidsongeschiktheid. Werkgevers met minder dan 50 werknemers zijn vrijgesteld.",
    "Rekenvoorbeeld. Ziekte-uitkering EUR 1.950,00 per maand. Bijdrage: EUR 1.950,00 x 30% = EUR 585,00 per maand, voor twee maanden EUR 1.170,00.",
    "De RSZ int de bijdrage per kwartaal op basis van de aangifte. Payroll Ops BE controleert de berekening in de kwartaalaangifte.",
  ], [["reintegration.employer_contribution", "30%", "een bijdrage van 30% van de ziekte-uitkering"]]);

formal("re_procB", "reintegration", "fr", "procedure", "Procédure cotisation employeur incapacité de travail",
  { owner: "P-16", author: "P-06", created: "2026-06-20", updated: "2026-07-09", eff: "2026-07-01",
    path: "SharePoint / Client Services Liège / Procédures" }, [
    "Objet. Traitement de la cotisation de responsabilisation des employeurs pendant l'incapacité de travail, à partir du 1er juillet 2026.",
    "Règle. L'employeur verse une cotisation de 25% de l'indemnité de maladie pendant les deuxième et troisième mois d'incapacité.",
    "Exemple : indemnité de EUR 1.950,00 par mois, cotisation de EUR 487,50 par mois, soit EUR 975,00 pour deux mois.",
    "Les employeurs de moins de 50 travailleurs ne sont pas concernés.",
  ], [["reintegration.employer_contribution", "25%", "une cotisation de 25% de l'indemnité de maladie"]]);

formal("re_legal", "reintegration", "en", "legal", "Sick leave reform 2026 - summary of the new rules",
  { owner: "P-12", author: "P-03", created: "2026-01-10", updated: "2026-03-02", eff: "2026-01-01" }, [
    "This summary covers the 2026 reform of incapacity for work for employees in the private sector.",
    "Guaranteed salary. The employer keeps paying the guaranteed salary during the first month of incapacity. This rule is unchanged.",
    "Return to work. The mutual insurance fund contacts the employee within 6 weeks of the start of incapacity to assess the possibilities for return to work.",
    "Employer contribution. The reform introduces an employer contribution during months two and three of incapacity, from 1 July 2026. The rate and the exemption for small employers are set by royal decree; see the procedures library for the rate that payroll applies.",
    "Example. An employee falls ill on 2 July 2026. Guaranteed salary until 1 August, sickness benefit from the mutual fund after that, employer contribution for August and September.",
  ]);

mail("re_email", "reintegration", "nl", "Bijdrage ziekte-uitkering Bouwbedrijf Claes",
  { owner: "P-14", author: "P-14", updated: "2026-07-15", eff: null, to: "P-15", time: "16:02" }, [
    "Hallo Laura,",
    "Bouwbedrijf Claes (PC 124) heeft 64 werknemers en valt dus onder de nieuwe werkgeversbijdrage. Een arbeider is sinds 2 juli arbeidsongeschikt.",
    "Ik reken met de procedure van Payroll Ops: ziekte-uitkering EUR 2.100,00 per maand, 30% bijdrage, dus EUR 630,00 voor augustus en EUR 630,00 voor september. Luik ging uit van 25%, vandaar mijn vraag.",
    "Kan je dit bevestigen?\n\nMehmet",
  ]);

chat("re_teams", "reintegration", "en", "Teams export - reintegration questions",
  { owner: null, author: "P-08", updated: "2026-02-20", eff: null, channelName: "Payroll BE / reintegration-questions" }, [
    ["08:55", "P-08", "A client asks how long they have for the reintegration plan. The new policy says 8 weeks, the old policy says 10 weeks."],
    ["09:01", "P-07", "The 2026 version applies, 8 weeks. The old policy can be archived."],
    ["09:02", "P-08", "It is still on SharePoint, I think clients still find it."],
    ["09:04", "P-07", "I will ask Knowledge Management."],
  ]);

formal("re_slides", "reintegration", "fr", "slides", "Réforme incapacité de travail 2026 - séance clients",
  { owner: "P-06", author: "P-06", created: "2026-02-10", updated: "2026-02-25", eff: "2026-01-01" }, [
    "Slide 1. Réforme 2026 de l'incapacité de travail",
    "Slide 2. Premier mois : salaire garanti payé par l'employeur, comme avant.",
    "Slide 3. Plan de réintégration : 8 semaines après l'évaluation.",
    "Slide 4. Exemple de coût : un mois de salaire garanti à EUR 3.200,00 brut, ensuite l'indemnité de la mutualité.",
    "Slide 5. Contact : Client Services Liège.",
  ]);

dup("re_dup", "re_procA", { owner: "P-14", author: "P-14", updated: "2026-07-16", file: "Procedure werkgeversbijdrage arbeidsongeschiktheid (1).pdf" },
  (b) => b.replace("Doel. Vanaf", "Doel. Opgelet: vanaf"));

// ---------------- Voluntary overtime ----------------

formal("vo_legal", "voluntary-overtime", "nl", "legal", "Vrijwillige overuren 2026 - wettelijk kader",
  { owner: "P-12", author: "P-07", created: "2026-03-28", updated: "2026-04-02", eff: "2026-04-01" }, [
    "Samenvatting van de regeling vrijwillige overuren zoals gewijzigd door de programmawet van maart 2026.",
    "Contingent. Een werknemer mag per kalenderjaar maximaal 360 vrijwillige overuren presteren. In de horeca geldt een hoger contingent van 450 uren.",
    "Akkoord. De werknemer sluit vooraf een schriftelijk akkoord met de werkgever dat geldig is voor 6 maanden en hernieuwbaar is.",
    "Loon. De eerste 240 uren zijn vrijgesteld van sociale bijdragen en bedrijfsvoorheffing; er is geen overloontoeslag verschuldigd. Voorbeeld: 10 vrijwillige overuren aan een uurloon van EUR 20,00 = EUR 200,00 bruto, gelijk aan netto.",
  ], [
    ["voluntary_overtime.annual_hours", "360 hours", "maximaal 360 vrijwillige overuren"],
    ["voluntary_overtime.agreement_duration", "6 months", "geldig is voor 6 maanden"],
  ]);

chat("vo_teams", "voluntary-overtime", "nl", "Teams export - Payroll Ops BE - overuren",
  { owner: "P-15", author: "P-04", updated: "2026-08-12", eff: null, channelName: "Payroll Ops BE / vragen" }, [
    ["13:20", "P-04", "Hoeveel vrijwillige overuren mag een bediende nu per jaar doen? Transport Verhaeghe vraagt het."],
    ["13:22", "P-02", "Dat is nog altijd 240 uur per jaar, niets veranderd."],
    ["13:23", "P-04", "Ok, dan zeg ik 240."],
    ["13:25", "P-02", "Ja, en vergeet het akkoord van 6 maanden niet."],
  ], [["voluntary_overtime.annual_hours", "240 hours", "Dat is nog altijd 240 uur per jaar"]]);

formal("vo_faq", "voluntary-overtime", "fr", "faq", "FAQ heures supplémentaires volontaires",
  { owner: "P-13", author: "P-09", created: "2026-04-08", updated: "2026-04-15", eff: "2026-04-01",
    path: "Confluence / PAYBE / FAQ clients FR" }, [
    "Cette FAQ explique le régime des heures supplémentaires volontaires à partir du 1er avril 2026.",
    "Combien d'heures ? Le travailleur peut prester jusqu'à 360 heures supplémentaires volontaires par année civile.",
    "Faut-il un accord écrit ? Oui, un accord écrit conclu à l'avance, valable 6 mois et renouvelable.",
    "Exemple : 12 heures à EUR 18,50 = EUR 222,00 brut, sans sursalaire ni récupération.",
  ], [
    ["voluntary_overtime.annual_hours", "360 hours", "jusqu'à 360 heures supplémentaires volontaires"],
    ["voluntary_overtime.agreement_duration", "6 months", "valable 6 mois"],
  ]);

formal("vo_proc", "voluntary-overtime", "en", "procedure", "Voluntary overtime - wage code setup",
  { owner: "P-15", author: "P-18", created: "2026-04-03", updated: "2026-04-10", eff: "2026-04-01" }, [
    "Purpose. This procedure sets up the wage codes for voluntary overtime in the payroll engine.",
    "Steps. 1. Use wage code 1260 for voluntary overtime hours. 2. The engine exempts the first 240 hours per year from social security and withholding tax. 3. Hours above 240 up to the yearly limit are subject to normal contributions.",
    "Example. 250 hours in 2026 at EUR 20.00: 240 hours exempt (EUR 4,800.00) and 10 hours taxed (EUR 200.00), total EUR 5,000.00 gross.",
  ]);

mail("vo_email", "voluntary-overtime", "nl", "Overuren eindejaar Bakkerij Janssens",
  { owner: null, author: "P-08", updated: "2025-12-02", eff: null, to: "shared", time: "11:48" }, [
    "Beste collega's,",
    "Bakkerij Janssens BV wil in december extra uren laten presteren voor de feestdagen. Tien werknemers zouden elk 20 uren extra doen.",
    "Totaal: 10 x 20 x EUR 16,40 = EUR 3.280,00 aan uren. Zijn dat vrijwillige overuren of gewone overuren met toeslag?",
    "Alvast bedankt,\nPieter",
  ]);

formal("vo_fr", "voluntary-overtime", "fr", "procedure", "Heures supplémentaires - règles France 2026",
  { owner: "P-06", author: "P-06", created: "2026-01-15", updated: "2026-02-04", eff: "2026-01-01", country: "FR",
    path: "SharePoint / Paie France / Procédures" }, [
    "Objet. Règles applicables aux heures supplémentaires pour les clients français de SD Worx France.",
    "Règle. Les heures au-delà de 35 heures par semaine sont majorées de 25 % pour les 8 premières heures et de 50 % au-delà. Le contingent annuel est fixé par accord de branche, à défaut 220 heures.",
    "Exemple : 4 heures supplémentaires à EUR 15,00 majorées de 25 % = EUR 75,00.",
  ], [["voluntary_overtime.annual_hours", "220 hours", "à défaut 220 heures"]]);

formal("vo_slides", "voluntary-overtime", "en", "slides", "Overtime 2024 - client session",
  { owner: "P-05", author: "P-05", created: "2024-05-28", updated: "2024-06-05", eff: "2024-01-01" }, [
    "Slide 1. Overtime and voluntary overtime in 2024",
    "Slide 2. Voluntary overtime: 120 hours per year, 220 in hospitality.",
    "Slide 3. Regular overtime: 50% premium, 100% on Sundays and public holidays.",
    "Slide 4. Example: 5 overtime hours x EUR 18.00 x 150% = EUR 135.00.",
    "Slide 5. Questions: Client Services Gent.",
  ]);

formal("vo_faq_nl", "voluntary-overtime", "nl", "faq", "Overuren - veelgestelde vragen",
  { owner: "P-13", author: "P-11", created: "2026-04-20", updated: "2026-05-06", eff: "2026-04-01" }, [
    "Wat is het verschil tussen gewone overuren en vrijwillige overuren? Gewone overuren geven recht op een toeslag en inhaalrust. Vrijwillige overuren geven geen toeslag en geen inhaalrust.",
    "Moet de klant de uren registreren? Ja, in de tijdsregistratie en in de maandelijkse prestaties naar Payroll Ops BE.",
    "Voorbeeld: 8 vrijwillige overuren x EUR 21,00 = EUR 168,00 bruto, zonder toeslag.",
  ]);

// ---------------- Year-end bonus PC 200 ----------------

formal("ye_procA", "year-end-bonus-pc200", "nl", "procedure", "Procedure eindejaarspremie PC 200",
  { owner: "P-15", author: "P-02", created: "2025-11-15", updated: "2026-01-20", eff: "2026-01-01" }, [
    "Doel. Deze procedure beschrijft de berekening van de eindejaarspremie voor bedienden in PC 200.",
    "Recht. De bediende heeft recht op een eindejaarspremie als hij minstens 6 maanden anciënniteit heeft in de onderneming op het moment van betaling.",
    "Bedrag. De premie is gelijk aan het volle bruto maandloon van december, pro rata van de gewerkte en gelijkgestelde maanden in het jaar.",
    "Rekenvoorbeeld. Bruto maandloon EUR 3.200,00, in dienst sinds 1 april 2026, dus 9 maanden in 2026. Premie: EUR 3.200,00 x 9 / 12 = EUR 2.400,00.",
  ], [["year_end_bonus.min_seniority", "6 months", "minstens 6 maanden anciënniteit", "PC 200"]]);

formal("ye_procB", "year-end-bonus-pc200", "fr", "procedure", "Procédure prime de fin d'année CP 200",
  { owner: "P-16", author: "P-09", created: "2025-12-02", updated: "2026-01-27", eff: "2026-01-01",
    path: "SharePoint / Client Services Brussels / Procédures" }, [
    "Objet. Calcul de la prime de fin d'année pour les employés de la CP 200 suivis par Client Services Brussels.",
    "Condition. L'employé doit compter au moins 1 an d'ancienneté dans l'entreprise pour avoir droit à la prime.",
    "Montant. Un mois de salaire brut, au prorata des mois prestés et assimilés.",
    "Exemple : salaire EUR 3.600,00, 10 mois prestés, prime EUR 3.000,00.",
  ], [["year_end_bonus.min_seniority", "1 year", "au moins 1 an d'ancienneté", "PC 200"]]);

formal("ye_faqA", "year-end-bonus-pc200", "nl", "faq", "FAQ eindejaarspremie",
  { owner: "P-13", author: "P-13", created: "2026-02-20", updated: "2026-03-02", eff: "2026-01-01" }, [
    "Wanneer wordt de eindejaarspremie betaald? De eindejaarspremie wordt uitbetaald samen met het loon van december.",
    "Wordt de premie belast? Ja, als exceptionele vergoeding tegen een apart tarief voor bedrijfsvoorheffing.",
    "Voorbeeld: premie EUR 2.400,00 bruto, RSZ 13,07% = EUR 313,68, belastbaar EUR 2.086,32.",
  ], [["year_end_bonus.payment_month", "December pay", "uitbetaald samen met het loon van december", "PC 200"]]);

formal("ye_faqB", "year-end-bonus-pc200", "nl", "faq", "Eindejaarspremie - vragen van klanten",
  { owner: null, author: "P-11", created: "2026-02-01", updated: "2026-02-14", eff: "2026-01-01" }, [
    "Deze pagina verzamelt vragen van klanten over de eindejaarspremie.",
    "Wanneer? De premie wordt betaald met het loon van november, zodat werknemers ze voor de feestdagen ontvangen.",
    "Wat bij uitdiensttreding? De werknemer krijgt een pro rata premie bij vertrek, behalve bij ontslag om dringende reden.",
  ], [["year_end_bonus.payment_month", "November pay", "betaald met het loon van november", "PC 200"]]);

formal("ye_policy", "year-end-bonus-pc200", "en", "policy", "Year-end bonus PC 200 - policy",
  { owner: "P-12", author: "P-03", created: "2025-12-15", updated: "2026-01-06", eff: "2026-01-01" }, [
    "Purpose. This policy sets the reference rules for the year-end bonus in joint committee 200 (PC 200) as applied by SD Worx Payroll BE.",
    "Rule. The bonus equals one gross monthly salary, pro rata of worked and assimilated months. Assimilated months include guaranteed salary during sickness and maternity leave.",
    "Example. An employee earning EUR 4,100.00 per month who was on maternity leave for 3 months and worked 9 months receives the full bonus of EUR 4,100.00, because maternity leave is assimilated.",
    "Clients in other joint committees follow their own sector agreement. PC 118, PC 124 and PC 140 each have their own formula.",
  ]);

mail("ye_email", "year-end-bonus-pc200", "nl", "Eindejaarspremie Bouwbedrijf Claes",
  { owner: "P-05", author: "P-05", updated: "2026-09-08", eff: null, to: "P-02", time: "08:52" }, [
    "Hoi Jens,",
    "Bouwbedrijf Claes vraagt of de eindejaarspremie van hun bedienden in PC 200 al door het plafond beperkt wordt. Ze hebben twee bedienden boven EUR 4.000.",
    "Volgens de rekennota van Payroll Ops heeft het plafond pas effect vanaf de indexering van januari 2027. Kan jij dat bevestigen voor ik de klant antwoord?",
    "Dank je,\nElise",
  ]);

chat("ye_teams", "year-end-bonus-pc200", "fr", "Teams export - Client Services Brussels - prime de fin d'année",
  { owner: "P-16", author: "P-09", updated: "2026-01-05", eff: null, channelName: "Client Services Brussels / général" }, [
    ["16:02", "P-09", "Pour la prime de fin d'année, un employé avec 8 mois d'ancienneté y a droit ?"],
    ["16:05", "P-16", "Chez nous on applique 1 an minimum, c'est dans notre procédure."],
    ["16:07", "P-09", "Gand applique 6 mois, je crois."],
    ["16:08", "P-16", "Il faudrait vérifier la CCT sectorielle."],
  ]);

dup("ye_dup", "ye_procA", { owner: "P-02", author: "P-02", updated: "2026-01-22", file: "Procedure eindejaarspremie PC 200 v2 FINAL.pdf" },
  (b) => b.replace("Doel. Deze procedure", "Doel. Deze (definitieve) procedure"));

formal("ye_slides", "year-end-bonus-pc200", "en", "slides", "Year-end bonus 2024 - training",
  { owner: "P-05", author: "P-05", created: "2025-01-08", updated: "2025-01-15", eff: "2025-01-01" }, [
    "Slide 1. Year-end bonus PC 200: calculation",
    "Slide 2. Bonus = gross monthly salary of December, pro rata.",
    "Slide 3. Example: EUR 3,000.00 x 12 / 12 = EUR 3,000.00.",
    "Slide 4. Paid with the December pay.",
    "Slide 5. Contact: Client Services Gent.",
  ]);

// ---------------- Kilometre allowance ----------------

formal("km_old", "km-allowance", "nl", "procedure", "Kilometervergoeding 2025-2026",
  { owner: "P-15", author: "P-18", created: "2025-06-25", updated: "2025-07-03", eff: "2025-07-01" }, [
    "Doel. Bedragen voor de terugbetaling van dienstverplaatsingen met een eigen wagen, geldig van 1 juli 2025 tot en met 30 juni 2026.",
    "Bedrag. De forfaitaire kilometervergoeding bedraagt EUR 0,4415 per kilometer. Het fiscale maximum is 24.000 kilometer per jaar.",
    "Rekenvoorbeeld. Een consultant rijdt 1.200 dienstkilometers in oktober 2025: 1.200 x EUR 0,4415 = EUR 529,80.",
  ], [
    ["km_allowance.rate", "€0.4415/km", "EUR 0,4415 per kilometer"],
    ["km_allowance.max_km", "24,000 km", "24.000 kilometer per jaar"],
  ]);

formal("km_new", "km-allowance", "fr", "procedure", "Indemnité kilométrique à partir du 1er juillet 2026",
  { owner: "P-16", author: "P-06", created: "2026-06-26", updated: "2026-07-02", eff: "2026-07-01",
    path: "SharePoint / Client Services Liège / Procédures" }, [
    "Objet. Montants applicables aux déplacements de service avec un véhicule privé à partir du 1er juillet 2026.",
    "Montant. L'indemnité kilométrique forfaitaire est de EUR 0,4280 par kilomètre, avec un maximum de 24.000 kilomètres par an.",
    "Exemple : 1.200 km en août 2026 x EUR 0,4280 = EUR 513,60.",
    "Le montant est revu chaque année au 1er juillet.",
  ], [
    ["km_allowance.rate", "€0.4280/km", "EUR 0,4280 par kilomètre"],
    ["km_allowance.max_km", "24,000 km", "24.000 kilomètres par an"],
  ]);

formal("km_faq", "km-allowance", "en", "faq", "Kilometre allowance FAQ",
  { owner: "P-13", author: "P-13", created: "2026-07-06", updated: "2026-07-10", eff: "2026-07-01" }, [
    "Does commuting count as a business trip? No. Home to work travel is covered by the commuting allowance, not by the kilometre allowance.",
    "Can the employer pay more than the flat rate? Yes, if the employer can prove the real cost. Otherwise the excess is taxed as salary.",
    "Example. 800 business kilometres at the flat rate of July 2026: 800 x EUR 0.4280 = EUR 342.40.",
  ]);

mail("km_email", "km-allowance", "nl", "Kilometervergoeding juli - Transport Verhaeghe",
  { owner: "P-14", author: "P-14", updated: "2026-07-06", eff: null, to: "P-02", time: "13:15" }, [
    "Hoi Jens,",
    "Transport Verhaeghe NV vraagt welk bedrag ze moeten gebruiken voor de kilometers van juni. Ritten van juni vallen nog onder het oude bedrag, klopt dat?",
    "Voor 950 km in juni: 950 x EUR 0,4415 = EUR 419,43. In juli zou dat 950 x EUR 0,4280 = EUR 406,60 zijn.",
    "Groeten,\nMehmet",
  ]);

chat("km_teams", "km-allowance", "en", "Teams export - Payroll Engine - km allowance",
  { owner: "P-10", author: "P-10", updated: "2026-07-01", eff: null, channelName: "Payroll Engine / releases" }, [
    ["08:30", "P-10", "The new kilometre rate is live in the payroll engine from the July run."],
    ["08:31", "P-15", "Also for the Liège clients?"],
    ["08:33", "P-10", "Yes, it is one parameter for all of Belgium."],
    ["08:34", "P-15", "Great, then we archive the old procedure."],
  ]);

dup("km_dup", "km_new", { owner: "P-06", author: "P-06", updated: "2026-07-03", file: "Indemnité kilométrique à partir du 1er juillet 2026 - copy.pdf" },
  (b) => b.replace("Le montant est revu", "Attention : le montant est revu"));

formal("km_lu", "km-allowance", "fr", "policy", "Indemnités kilométriques Luxembourg 2026",
  { owner: "P-06", author: "P-06", created: "2026-01-12", updated: "2026-02-02", eff: "2026-01-01", country: "LU",
    path: "SharePoint / Payroll LU / Politiques" }, [
    "Objet. Frais de route pour les salariés des clients luxembourgeois de SD Worx Luxembourg.",
    "Règle. L'indemnité est de EUR 0,30 par kilomètre pour les déplacements professionnels.",
    "Exemple : 600 km x EUR 0,30 = EUR 180,00.",
  ], [["km_allowance.rate", "€0.30/km", "L'indemnité est de EUR 0,30 par kilomètre"]]);

// ---------------- Flexi-jobs ----------------

formal("fx_legal", "flexi-jobs", "fr", "legal", "Flexi-jobs 2026 - cadre légal",
  { owner: "P-12", author: "P-03", created: "2025-12-20", updated: "2026-01-09", eff: "2026-01-01" }, [
    "Résumé des règles applicables aux flexi-jobs à partir du 1er janvier 2026.",
    "Flexi-salaire. Le flexi-salaire minimum est de EUR 12,29 de l'heure, pécule de vacances compris.",
    "Cotisation patronale. L'employeur paie une cotisation spéciale de 28% sur le flexi-salaire. Le travailleur ne paie ni cotisations ni précompte.",
    "Exemple : 20 heures x EUR 12,29 = EUR 245,80 de flexi-salaire. Cotisation patronale : EUR 245,80 x 28% = EUR 68,82. Coût total : EUR 314,62.",
    "Secteurs autorisés : notamment l'horeca (CP 302), le commerce et, depuis 2024, les soins de santé (CP 330).",
  ], [
    ["flexi_jobs.min_hourly_wage", "€12.29", "Le flexi-salaire minimum est de EUR 12,29 de l'heure"],
    ["flexi_jobs.employer_contribution", "28%", "une cotisation spéciale de 28% sur le flexi-salaire"],
  ]);

mail("fx_email", "flexi-jobs", "fr", "RE: flexi-jobs Brasserie du Parc",
  { owner: "P-06", author: "P-06", updated: "2026-08-20", eff: null, to: "P-09", time: "17:05", file: "RE flexi-jobs Brasserie du Parc.pdf" }, [
    "Bonjour Amélie,",
    "Pour la Brasserie du Parc SRL (CP 302), j'ai recalculé les flexi-jobs d'août. La cotisation patronale est de 25%, donc pour 120 heures x EUR 12,29 = EUR 1.474,80 la cotisation est de EUR 368,70.",
    "Le client est content, c'est moins que prévu.",
    "Bien à toi,\nMathieu",
  ], [["flexi_jobs.employer_contribution", "25%", "La cotisation patronale est de 25%"]]);

formal("fx_slides", "flexi-jobs", "nl", "slides", "Flexi-jobs horeca - opleiding 2025",
  { owner: "P-05", author: "P-05", created: "2025-03-01", updated: "2025-03-10", eff: "2025-01-01" }, [
    "Slide 1. Flexi-jobs in de horeca",
    "Slide 2. Minimum flexiloon: EUR 12,05 per uur, inclusief vakantiegeld.",
    "Slide 3. Voorwaarde: 4/5 tewerkstelling bij een andere werkgever in het kwartaal T-3.",
    "Slide 4. Voorbeeld: 30 uren x EUR 12,05 = EUR 361,50.",
    "Slide 5. Vragen: Client Services Gent.",
  ], [["flexi_jobs.min_hourly_wage", "€12.05", "Minimum flexiloon: EUR 12,05 per uur"]]);

formal("fx_proc", "flexi-jobs", "nl", "procedure", "Procedure flexi-jobs Dimona en aangifte",
  { owner: "P-15", author: "P-04", created: "2026-01-10", updated: "2026-01-22", eff: "2026-01-01" }, [
    "Doel. Deze procedure beschrijft de Dimona-aangifte en de verloning van flexi-jobs.",
    "Stappen. 1. Doe een Dimona FLX per prestatie, voor aanvang. 2. Registreer de uren in de tijdsregistratie. 3. Controleer of de werknemer in T-3 minstens 4/5 werkte bij een andere werkgever of gepensioneerd is.",
    "Voorbeeld: Brasserie du Parc SRL zet 3 flexi-jobbers in voor 16 uren elk: 48 x EUR 12,29 = EUR 589,92 flexiloon.",
  ]);

formal("fx_faq", "flexi-jobs", "en", "faq", "Flexi-jobs FAQ for clients",
  { owner: "P-13", author: "P-13", created: "2026-02-05", updated: "2026-02-18", eff: "2026-01-01" }, [
    "Who can do a flexi-job? Employees who worked at least 4/5 for another employer in quarter T-3, and pensioners.",
    "Is there a yearly limit? Yes, flexi income above EUR 18,000 per year is taxed, except for pensioners.",
    "Example. A pensioner works 10 hours per week for 4 weeks at EUR 13.00: 40 x EUR 13.00 = EUR 520.00 flexi pay.",
  ]);

chat("fx_teams", "flexi-jobs", "nl", "Teams export - Client Services Gent - flexi-jobs",
  { owner: null, author: "P-11", updated: "2026-05-12", eff: null, channelName: "Client Services Gent / algemeen" }, [
    ["14:02", "P-11", "Mag Clinique Saint-Luc flexi-jobbers inzetten in de keuken?"],
    ["14:05", "P-05", "Ja, PC 330 mag sinds 2024 flexi-jobs gebruiken."],
    ["14:06", "P-11", "Ook voor verpleegkundigen?"],
    ["14:09", "P-05", "Ik denk het wel, maar check de lijst van functies in de wettekst."],
  ]);

formal("fx_faq_fr", "flexi-jobs", "fr", "faq", "FAQ flexi-jobs horeca",
  { owner: "P-09", author: "P-09", created: "2026-02-25", updated: "2026-03-05", eff: "2026-01-01",
    path: "Confluence / PAYBE / FAQ clients FR" }, [
    "Un flexi-job peut-il remplacer un contrat fixe ? Non, le travailleur doit avoir un emploi principal d'au moins 4/5 chez un autre employeur.",
    "Faut-il un contrat-cadre ? Oui, un contrat-cadre écrit avant la première prestation.",
    "Exemple : 25 heures x EUR 12,50 = EUR 312,50 de flexi-salaire.",
  ]);

dup("fx_dup", "fx_legal", { owner: "P-09", author: "P-09", updated: "2026-01-14", file: "Flexi-jobs 2026 - cadre légal (1).pdf" },
  (b) => b.replace("Résumé des règles", "Résumé (copie) des règles"));

// ---------------- Payroll cut-off ----------------

formal("pc_verhA", "payroll-cutoff", "nl", "procedure", "Afsluitkalender Transport Verhaeghe 2026",
  { owner: "P-05", author: "P-11", created: "2025-12-18", updated: "2026-01-05", eff: "2026-01-01",
    path: "SharePoint / Client Services Gent / Klantdossiers" }, [
    "Doel. Deze kalender legt de maandelijkse afsluitdatum vast voor Transport Verhaeghe NV (PC 140).",
    "Afsluiting. De prestaties van Transport Verhaeghe NV moeten elke maand uiterlijk op de 20e bij Payroll Ops BE zijn. Valt de 20e in een weekend, dan geldt de vrijdag ervoor.",
    "Correcties na de afsluiting worden meegenomen in de volgende maand, behalve voor uitdiensttredingen.",
    "Voorbeeld: in september 2026 valt de 20e op zondag, dus afsluiting op vrijdag 18 september.",
  ], [["payroll_cutoff.transport_verhaeghe", "20th of the month", "uiterlijk op de 20e", "Transport Verhaeghe NV"]]);

formal("pc_verhB", "payroll-cutoff", "nl", "procedure", "Procedure maandafsluiting klanten PC 140",
  { owner: "P-15", author: "P-02", created: "2025-12-22", updated: "2026-01-12", eff: "2026-01-01" }, [
    "Doel. Deze procedure geldt voor alle klanten in PC 140 (vervoer) die Payroll Ops BE verloont.",
    "Afsluiting. Voor Transport Verhaeghe NV sluit Payroll Ops BE de prestaties af op de 22e van de maand, omdat de klant de ritregistratie pas op de 21e aanlevert.",
    "Controle. Vergelijk het aantal chauffeurs in de ritregistratie met het aantal dossiers. Verschillen groter dan 2 worden gemeld aan de klant.",
    "Voorbeeld: 48 chauffeurs, 47 dossiers: 1 verschil, geen melding nodig.",
  ], [["payroll_cutoff.transport_verhaeghe", "22nd of the month", "op de 22e van de maand", "Transport Verhaeghe NV"]]);

formal("pc_stluc", "payroll-cutoff", "fr", "procedure", "Calendrier de clôture Clinique Saint-Luc 2026",
  { owner: "P-16", author: "P-09", created: "2025-12-19", updated: "2026-01-08", eff: "2026-01-01",
    path: "SharePoint / Client Services Brussels / Procédures" }, [
    "Objet. Date de clôture mensuelle pour la Clinique Saint-Luc ASBL (CP 330).",
    "Clôture. Les prestations de la Clinique Saint-Luc ASBL doivent parvenir à Payroll Ops BE au plus tard le 18 de chaque mois.",
    "Les prestations de nuit et de week-end du personnel infirmier sont transmises dans le même fichier.",
    "Exemple : 212 travailleurs, dont 64 avec des prestations de nuit en mars 2026.",
  ], [["payroll_cutoff.clinique_saint_luc", "18th of the month", "au plus tard le 18 de chaque mois", "Clinique Saint-Luc ASBL"]]);

chat("pc_teams", "payroll-cutoff", "fr", "Teams export - Client Services Brussels - clôture",
  { owner: "P-16", author: "P-16", updated: "2026-09-10", eff: null, channelName: "Client Services Brussels / clôtures" }, [
    ["10:15", "P-16", "La Clinique Saint-Luc demande si elle peut envoyer les prestations plus tôt. On passe au 15 ?"],
    ["10:18", "P-09", "Le calendrier dit le 18."],
    ["10:20", "P-16", "À partir d'octobre, la clôture de la Clinique Saint-Luc est le 15 du mois, je viens de leur confirmer."],
    ["10:21", "P-09", "Il faut mettre à jour le calendrier alors."],
  ], [["payroll_cutoff.clinique_saint_luc", "15th of the month", "la clôture de la Clinique Saint-Luc est le 15 du mois", "Clinique Saint-Luc ASBL"]]);

formal("pc_bakk", "payroll-cutoff", "nl", "procedure", "Afsluitdata Bakkerij Janssens 2026",
  { owner: "P-05", author: "P-11", created: "2025-12-15", updated: "2026-01-06", eff: "2026-01-01",
    path: "SharePoint / Client Services Gent / Klantdossiers" }, [
    "Doel. Maandelijkse afsluitdatum voor Bakkerij Janssens BV (PC 118).",
    "Afsluiting. Bakkerij Janssens BV bezorgt de prestaties elke maand ten laatste op de 25e.",
    "Nachtwerk en zondagwerk worden apart gemeld, met de uren per werknemer.",
    "Voorbeeld: 34 werknemers, 5.780 gewerkte uren in maart 2026.",
  ], [["payroll_cutoff.bakkerij_janssens", "25th of the month", "ten laatste op de 25e", "Bakkerij Janssens BV"]]);

formal("pc_faq", "payroll-cutoff", "nl", "faq", "FAQ maandafsluiting klanten",
  { owner: "P-13", author: "P-13", created: "2026-01-20", updated: "2026-02-01", eff: "2026-01-01" }, [
    "Waarom verschilt de afsluitdatum per klant? De datum hangt af van het paritair comité, het aantal werknemers en de manier waarop de klant de prestaties aanlevert.",
    "Wat is de afsluitdatum voor Bakkerij Janssens BV? De afsluiting voor Bakkerij Janssens BV valt op de 25e van de maand.",
    "Wat als de klant te laat is? Dan verwerkt Payroll Ops BE de prestaties in een aanvullende run, aan het tarief van EUR 45,00 per run.",
  ], [["payroll_cutoff.bakkerij_janssens", "25th of the month", "valt op de 25e van de maand", "Bakkerij Janssens BV"]]);

formal("pc_slides", "payroll-cutoff", "en", "slides", "Payroll close calendar 2026 - overview",
  { owner: "P-15", author: "P-15", created: "2026-01-12", updated: "2026-01-15", eff: "2026-01-01" }, [
    "Slide 1. Payroll close calendar 2026, Payroll Ops BE",
    "Slide 2. Each client has its own monthly close date. The date is agreed in the service contract.",
    "Slide 3. Late data goes into an extra run at EUR 45.00 per run.",
    "Slide 4. Example: 3 late months x EUR 45.00 = EUR 135.00 on the yearly invoice.",
    "Slide 5. Questions: Laura Van Damme, Payroll Ops BE.",
  ]);

mail("pc_email", "payroll-cutoff", "nl", "Afsluiting oktober Bouwbedrijf Claes",
  { owner: null, author: "P-08", updated: "2025-10-28", eff: null, to: "shared", time: "17:40" }, [
    "Beste,",
    "Bouwbedrijf Claes (PC 124) heeft de prestaties van oktober pas op de 27e gestuurd. De afsluiting is de 24e.",
    "Extra run aangerekend: EUR 45,00. Kan iemand dit bevestigen aan de klant?",
    "Groeten,\nPieter",
  ]);

dup("pc_dup", "pc_verhA", { owner: "P-11", author: "P-11", updated: "2026-02-03", file: "Afsluitkalender Transport Verhaeghe 2026 (1).pdf" },
  (b) => b.replace("Correcties na de afsluiting", "Opgelet: correcties na de afsluiting"));

formal("pc_bridge", "payroll-cutoff", "nl", "procedure", "Planning indexering januari 2027 - afsluitkalender",
  { owner: "P-15", author: "P-02", created: "2026-09-01", updated: "2026-09-14", eff: "2026-09-01", bridge: "indexation-cap" }, [
    "Doel. Deze planning legt vast wanneer Payroll Ops BE de indexering van januari 2027 voorbereidt, rekening houdend met de afsluitdata per klant.",
    "Voor klanten in PC 200 wordt de indexering met plafond in de loonmotor klaargezet vóór de afsluiting van december 2026. De simulatie loopt van 1 tot 10 december.",
    "Afsluitdata januari 2027: Bakkerij Janssens BV op de 25e, Clinique Saint-Luc ASBL op de 18e, Bouwbedrijf Claes op de 24e.",
  ]);

// ---------------- Notice period ----------------

formal("np_legal", "notice-period", "nl", "legal", "Opzeggingstermijnen - wet eenheidsstatuut",
  { owner: "P-12", author: "P-07", created: "2023-03-01", updated: "2026-02-10", eff: "2014-01-01" }, [
    "Samenvatting van de opzeggingstermijnen volgens de wet van 26 december 2013 betreffende het eenheidsstatuut, zoals van toepassing in 2026.",
    "Opzeg door de werkgever. Bij een anciënniteit van 5 jaar bedraagt de opzeggingstermijn 15 weken. Na 5 jaar komen er 3 weken bij per begonnen jaar anciënniteit tot 20 jaar.",
    "Opzeg door de werknemer. De opzeggingstermijn bij ontslag door de werknemer bedraagt maximaal 13 weken.",
    "Voorbeeld: een bediende met 5 jaar anciënniteit en een brutoloon van EUR 3.900,00 per maand. Een verbrekingsvergoeding voor 15 weken bedraagt EUR 3.900,00 x 3 x 15 / 13 = EUR 13.500,00.",
  ], [
    ["notice_period.five_years", "15 weeks", "Bij een anciënniteit van 5 jaar bedraagt de opzeggingstermijn 15 weken"],
    ["notice_period.employee_max", "13 weeks", "maximaal 13 weken"],
  ]);

formal("np_slides", "notice-period", "fr", "slides", "Délais de préavis - formation 2024",
  { owner: "P-06", author: "P-06", created: "2024-05-10", updated: "2024-05-22", eff: "2024-01-01" }, [
    "Slide 1. Délais de préavis : statut unique",
    "Slide 2. Licenciement par l'employeur : 5 ans d'ancienneté = 18 semaines de préavis.",
    "Slide 3. Démission par le travailleur : maximum 13 semaines.",
    "Slide 4. Exemple : salaire EUR 3.250,00, indemnité de 18 semaines = EUR 13.500,00.",
    "Slide 5. Contact : Client Services Liège.",
  ], [
    ["notice_period.five_years", "18 weeks", "5 ans d'ancienneté = 18 semaines de préavis"],
    ["notice_period.employee_max", "13 weeks", "maximum 13 semaines"],
  ]);

formal("np_faq", "notice-period", "nl", "faq", "FAQ opzeg door de werknemer",
  { owner: "P-13", author: "P-13", created: "2026-02-01", updated: "2026-02-12", eff: "2026-01-01" }, [
    "Hoe lang is de opzeg als een werknemer zelf ontslag neemt? Dat hangt af van de anciënniteit, met een maximum van 13 weken.",
    "Mag de werknemer korter opzeggen bij een nieuwe job? Ja, tijdens een opzeg gegeven door de werkgever, via een tegenopzeg van maximaal 4 weken.",
    "Voorbeeld: een bediende met 3 jaar anciënniteit neemt ontslag en heeft 6 weken opzeg.",
  ], [["notice_period.employee_max", "13 weeks", "met een maximum van 13 weken"]]);

formal("np_proc", "notice-period", "en", "procedure", "Termination pay - calculation procedure",
  { owner: "P-15", author: "P-02", created: "2025-11-20", updated: "2026-03-18", eff: "2026-01-01" }, [
    "Purpose. This procedure explains how Payroll Ops BE computes termination pay when the employer ends the contract without notice.",
    "Formula. Weekly pay = monthly gross x 3 / 13. Termination pay = weekly pay x notice weeks from the legal table, plus the value of benefits in kind and variable pay over the last 12 months.",
    "Example. Monthly gross EUR 4,550.00, 10 weeks notice: weekly pay EUR 1,050.00, termination pay EUR 10,500.00.",
  ]);

mail("np_email", "notice-period", "fr", "Préavis Clinique Saint-Luc - infirmière 7 ans",
  { owner: "P-03", author: "P-03", updated: "2026-06-11", eff: null, to: "P-16", time: "15:26" }, [
    "Bonjour Julien,",
    "Pour l'infirmière de la Clinique Saint-Luc ASBL avec 7 ans d'ancienneté, le préavis est de 21 semaines (15 semaines à 5 ans, puis 3 semaines par année entamée).",
    "Avec un salaire de EUR 3.640,00, l'indemnité s'élève à EUR 3.640,00 x 3 / 13 x 21 = EUR 17.640,00.",
    "Cordialement,\nSophie",
  ]);

chat("np_teams", "notice-period", "nl", "Teams export - Payroll Ops BE - opzeg",
  { owner: "P-15", author: "P-14", updated: "2026-03-03", eff: null, channelName: "Payroll Ops BE / vragen" }, [
    ["11:11", "P-14", "Welke opzegtermijn gebruik ik voor een arbeider van Bouwbedrijf Claes met 5 jaar anciënniteit?"],
    ["11:13", "P-15", "Eenheidsstatuut, dus dezelfde tabel als voor bedienden: 15 weken."],
    ["11:14", "P-14", "De slides van de opleiding zeggen 18."],
    ["11:16", "P-15", "Die slides zijn van 2024 en fout. Gebruik de wettekst op mysdworx."],
  ]);

formal("np_nl", "notice-period", "nl", "policy", "Opzegtermijn Nederland - beleid 2026",
  { owner: "P-17", author: "P-17", created: "2026-01-05", updated: "2026-01-16", eff: "2026-01-01", country: "NL",
    path: "SharePoint / Payroll NL / Beleid" }, [
    "Doel. Opzegtermijnen voor Nederlandse werkgevers die via SD Worx Nederland verlonen.",
    "Regel. Bij een dienstverband van 5 tot 10 jaar bedraagt de opzegtermijn voor de werkgever 2 maanden.",
    "Voorbeeld: opzegging op 15 maart, einde dienstverband op 31 mei.",
  ], [["notice_period.five_years", "2 months", "bedraagt de opzegtermijn voor de werkgever 2 maanden"]]);

// ---------------- Company car solidarity ----------------

formal("cc_procA", "company-car-solidarity", "nl", "procedure", "Procedure solidariteitsbijdrage bedrijfswagens 2026",
  { owner: "P-15", author: "P-18", created: "2025-12-28", updated: "2026-01-07", eff: "2026-01-01" }, [
    "Doel. Berekening van de maandelijkse CO2-solidariteitsbijdrage voor bedrijfswagens in 2026.",
    "Minimum. De minimale solidariteitsbijdrage bedraagt EUR 33,62 per maand per wagen in 2026, ook voor elektrische wagens.",
    "Rekenvoorbeeld. Een klant met 25 elektrische bedrijfswagens betaalt minimaal 25 x EUR 33,62 = EUR 840,50 per maand, of EUR 10.086,00 per jaar.",
    "De loonmotor berekent de bijdrage automatisch op basis van de CO2-uitstoot en het brandstoftype in het voertuigbestand.",
  ], [["company_car.min_solidarity", "€33.62", "De minimale solidariteitsbijdrage bedraagt EUR 33,62 per maand"]]);

formal("cc_procB", "company-car-solidarity", "fr", "procedure", "Procédure cotisation de solidarité voitures de société",
  { owner: "P-16", author: "P-06", created: "2026-01-05", updated: "2026-01-19", eff: "2026-01-01",
    path: "SharePoint / Client Services Liège / Procédures" }, [
    "Objet. Calcul de la cotisation CO2 de solidarité pour les voitures de société en 2026.",
    "Minimum. La cotisation minimale est de EUR 32,95 par mois et par véhicule.",
    "Exemple : 10 véhicules électriques x EUR 32,95 = EUR 329,50 par mois.",
  ], [["company_car.min_solidarity", "€32.95", "La cotisation minimale est de EUR 32,95 par mois"]]);

formal("cc_polA", "company-car-solidarity", "en", "policy", "Company car policy 2026 - deductibility",
  { owner: "P-12", author: "P-03", created: "2025-12-10", updated: "2026-01-12", eff: "2026-01-01" }, [
    "Purpose. This policy sets the tax deductibility of company cars that SD Worx applies in client advice for 2026.",
    "Zero-emission cars ordered in 2026 are 95% deductible.",
    "Plug-in hybrids. A plug-in hybrid ordered between 1 July 2023 and 31 December 2025 is 50% deductible in 2026.",
    "Example. Fuel and lease costs of EUR 9,600.00 per year for a plug-in hybrid: deductible EUR 4,800.00.",
  ], [["company_car.hybrid_deduction", "50%", "is 50% deductible in 2026"]]);

formal("cc_polB", "company-car-solidarity", "nl", "policy", "Bedrijfswagenbeleid 2026 - fiscale aftrek",
  { owner: "P-07", author: "P-07", created: "2026-01-20", updated: "2026-02-03", eff: "2026-01-01" }, [
    "Doel. Dit beleid bundelt de fiscale aftrekregels voor bedrijfswagens die klanten in 2026 inzetten.",
    "Plug-inhybrides. Voor een plug-inhybride besteld vóór 1 januari 2026 geldt in 2026 een aftrek van 75% voor de kosten.",
    "Voorbeeld: EUR 9.600,00 kosten per jaar, aftrekbaar EUR 7.200,00.",
    "Emissievrije wagens besteld in 2026 zijn voor 95% aftrekbaar.",
  ], [["company_car.hybrid_deduction", "75%", "geldt in 2026 een aftrek van 75%"]]);

mail("cc_email", "company-car-solidarity", "nl", "Solidariteitsbijdrage Transport Verhaeghe",
  { owner: "P-05", author: "P-05", updated: "2026-03-10", eff: null, to: "P-15", time: "10:33" }, [
    "Hoi Laura,",
    "Transport Verhaeghe NV heeft 12 elektrische bedrijfswagens. De factuur van januari toont EUR 403,44 aan solidariteitsbijdrage.",
    "Dat klopt met 12 x EUR 33,62 = EUR 403,44. Luik rekent met EUR 32,95, dat zou EUR 395,40 geven. Welke is juist?",
    "Groetjes,\nElise",
  ]);

chat("cc_teams", "company-car-solidarity", "fr", "Teams export - Client Services Brussels - voitures",
  { owner: null, author: "P-09", updated: "2026-02-02", eff: null, channelName: "Client Services Brussels / général" }, [
    ["09:40", "P-09", "Brasserie du Parc veut acheter une hybride. Elle sera déductible à combien ?"],
    ["09:44", "P-06", "Ça dépend de la date de commande. Commandée en 2026, la déduction des frais de carburant est très limitée."],
    ["09:46", "P-09", "Je vais renvoyer vers la politique voitures de société."],
  ]);

formal("cc_faq", "company-car-solidarity", "en", "faq", "Company cars FAQ",
  { owner: null, author: "P-08", created: "2024-01-15", updated: "2024-10-02", eff: "2024-01-01" }, [
    "How is the benefit in kind for a company car computed? It depends on the catalogue value, the CO2 emissions and the age of the car.",
    "Example 2024: catalogue value EUR 42,000.00, CO2 percentage 5.5%, factor 6/7: EUR 42,000.00 x 5.5% x 6/7 = EUR 1,980.00 per year, or EUR 165.00 per month.",
    "Does the employee have to contribute? A personal contribution reduces the benefit in kind.",
  ]);

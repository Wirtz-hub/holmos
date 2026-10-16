import { newBlock, newStep, siteSchema, type Block, type FunnelDoc, type Language, type ServiceIcon } from "@/lib/funnels/schema";

const STOCK = "unsplash:";

// Ready-made websites for common kinds of businesses: four pages (front page,
// services, about, contact) with a menu and footer. The words are Danish
// starter copy to adjust. Pictures are written as "unsplash:<search words>"
// and swapped for real stock photos when the site is created.

type Copy = {
  accent: string;
  font?: "sans" | "serif";
  background?: "white" | "soft";
  hero: { eyebrow: string; heading: string; text: string; button: string; image: string };
  servicesIntro: string;
  services: [ServiceIcon, string, string][];
  about: { heading: string; text: string; image: string };
  story: string;
  stats: [string, string][];
  testimonials: [string, string, string][];
  faq: [string, string][];
  pricing?: [string, string, string, string, boolean?][];
  cta: { heading: string; text: string; button: string };
  hours: string;
  team: string[];
  gallery?: string[];
};

const COPY = {
  dentist: {
    accent: "#0f766e",
    hero: {
      eyebrow: "Din lokale tandlæge",
      heading: "Tryg tandpleje for hele familien",
      text: "Vi tager os god tid, forklarer undervejs og gør alt for, at du føler dig godt tilpas i stolen.",
      button: "Book tid",
      image: "unsplash:dentist clinic",
    },
    servicesIntro: "Fra det årlige eftersyn til større behandlinger – vi klarer det meste under samme tag.",
    services: [
      ["smile", "Undersøgelse og rens", "Grundigt eftersyn, tandrens og gode råd til den daglige tandpleje."],
      ["sparkles", "Tandblegning", "Et hvidere smil med en skånsom blegning, der er tilpasset dine tænder."],
      ["shield", "Fyldninger og kroner", "Holdbare løsninger i tandfarvet materiale, der ligner dine egne tænder."],
      ["heart", "Angstpatienter", "Er du nervøs for tandlægen? Vi går stille frem og aftaler alt på forhånd."],
    ],
    about: {
      heading: "En klinik med tid til dig",
      text: "Hos {business} er der ingen samlebånd. Vi kender vores patienter og bruger tiden på at forklare, hvad vi gør, og hvorfor.",
      image: "unsplash:dental clinic interior",
    },
    story:
      "{business} har passet på tænderne i lokalområdet i mange år. Vi er et lille, fast team, så du møder de samme ansigter hver gang.\n\nVi investerer løbende i nyt udstyr og efteruddannelse, så du får en moderne behandling – men altid i et tempo, hvor der er plads til spørgsmål.",
    stats: [
      ["20+", "års erfaring"],
      ["4.000", "faste patienter"],
      ["4,9", "i snit på Google"],
    ],
    testimonials: [
      ["Jeg har altid været bange for tandlægen, men her føler jeg mig tryg. De forklarer alt og har god tid.", "Mette", "Patient i 6 år"],
      ["Hurtig tid, venligt personale og en fair pris. Kan varmt anbefales.", "Lars", "Patient"],
    ],
    faq: [
      ["Tager I imod nye patienter?", "Ja. Ring eller skriv til os, så finder vi en tid til en første undersøgelse."],
      ["Hvad koster en undersøgelse?", "Prisen afhænger af, hvad der skal gøres. Du får altid et prisoverslag, før vi går i gang med større behandlinger."],
      ["Kan jeg få en akut tid?", "Vi holder tider fri hver dag til akutte patienter. Ring tidligt på dagen."],
    ],
    cta: { heading: "Klar til et tjek?", text: "Book en tid eller ring til os – vi glæder os til at se dig.", button: "Book tid" },
    hours: "Mandag–torsdag: 8–16\nFredag: 8–14\nLørdag–søndag: Lukket",
    team: ["Tandlæge", "Tandplejer", "Klinikassistent"],
  },
  physio: {
    accent: "#0e7490",
    hero: {
      eyebrow: "Fysioterapi og genoptræning",
      heading: "Kom smertefri tilbage til hverdagen",
      text: "Vi finder årsagen til dine smerter og lægger en plan, du kan følge – med øvelser, behandling og vejledning.",
      button: "Book tid",
      image: "unsplash:physiotherapy",
    },
    servicesIntro: "Vi behandler alt fra ondt i ryggen til sportsskader og genoptræning efter operation.",
    services: [
      ["dumbbell", "Genoptræning", "Målrettet træning efter skader og operationer, så du kommer stærkt tilbage."],
      ["heart", "Ryg og nakke", "Behandling af smerter i ryg, nakke og skuldre – og øvelser, så de ikke kommer igen."],
      ["award", "Sportsskader", "Hurtig undersøgelse og en plan, der får dig tilbage til din sport."],
      ["users", "Holdtræning", "Træn sammen med andre på små hold med en fysioterapeut ved din side."],
    ],
    about: {
      heading: "Behandling der virker – også på lang sigt",
      text: "Vi tror på, at du skal forstå din krop. Derfor får du altid en forklaring og et program, du kan lave hjemme.",
      image: "unsplash:physiotherapist treatment",
    },
    story:
      "{business} blev startet med ét mål: at gøre det let at få god fysioterapi tæt på, hvor du bor.\n\nVores fysioterapeuter har hver deres speciale, så du altid bliver behandlet af en, der kender netop dit problem.",
    stats: [
      ["15", "års erfaring"],
      ["10.000+", "behandlinger"],
      ["Ingen", "henvisning nødvendig"],
    ],
    testimonials: [
      ["Efter fire behandlinger kunne jeg løbe igen. Super kompetent og venlig.", "Sofie", "Løber"],
      ["Endelig nogen der fandt årsagen til mine rygsmerter.", "Peter", "Kontoransat"],
    ],
    faq: [
      ["Skal jeg have en henvisning?", "Nej, du kan bare booke en tid. Har du en henvisning fra lægen, får du tilskud fra det offentlige."],
      ["Får jeg tilskud via sygeforsikringen?", "Ja, er du medlem af Sygeforsikringen danmark, får du tilskud til behandlingen."],
      ["Hvad skal jeg have på?", "Tøj du kan bevæge dig i. Vi har håndklæder og omklædning."],
    ],
    pricing: [
      ["Første konsultation", "595 kr.", "60 min.", "- Grundig undersøgelse\n- Behandling\n- Hjemmeøvelser"],
      ["Opfølgning", "450 kr.", "30 min.", "- Behandling\n- Justering af øvelser", true],
      ["Holdtræning", "800 kr.", "8 gange", "- Små hold\n- Fysioterapeut på holdet"],
    ],
    cta: { heading: "Book din første tid", text: "Du kan typisk få en tid inden for få dage.", button: "Book tid" },
    hours: "Mandag–torsdag: 7–19\nFredag: 7–15\nLørdag: 9–12",
    team: ["Fysioterapeut", "Fysioterapeut", "Sekretær"],
  },
  hairdresser: {
    accent: "#be123c",
    background: "soft",
    hero: {
      eyebrow: "Frisør",
      heading: "Hår der passer til dig",
      text: "Klip, farve og styling i rolige omgivelser – med tid til at lytte til, hvad du ønsker.",
      button: "Book tid",
      image: "unsplash:hair salon",
    },
    servicesIntro: "Vi klipper damer, herrer og børn – og hjælper med farve, striber og styling til store dage.",
    services: [
      ["scissors", "Klip", "Dame-, herre- og børneklip med vask og føn."],
      ["paintbrush", "Farve og striber", "Fra en diskret glans til en helt ny farve – vi rådgiver altid først."],
      ["sparkles", "Bryllup og fest", "Opsætning og styling til den store dag, med prøve forinden."],
      ["leaf", "Hårkur", "Plejende behandlinger, der giver håret glans og styrke."],
    ],
    about: {
      heading: "Et pusterum midt i hverdagen",
      text: "Hos {business} får du en kop kaffe, god tid og en frisør, der kender sit håndværk.",
      image: "unsplash:hairdresser",
    },
    story:
      "{business} er en hyggelig salon, hvor kvalitet og god stemning går hånd i hånd.\n\nVi bruger produkter, der er skånsomme for både hår og miljø, og vi tager os altid tid til at finde den løsning, der passer til dig.",
    stats: [
      ["12", "års erfaring"],
      ["2.500", "glade kunder"],
      ["4,8", "i snit på Google"],
    ],
    testimonials: [
      ["Bedste klip jeg har fået i årevis. Hun lyttede virkelig til, hvad jeg ville have.", "Camilla", "Fast kunde"],
      ["Hyggelig salon og super resultat med farven.", "Anne", "Kunde"],
    ],
    faq: [
      ["Kan jeg booke online?", "Ja, du kan booke din tid her på siden døgnet rundt."],
      ["Hvad hvis jeg bliver forhindret?", "Aflys senest 24 timer før, så kan en anden få tiden."],
      ["Klipper I børn?", "Ja, vi klipper børn i alle aldre."],
    ],
    pricing: [
      ["Herreklip", "350 kr.", "", "- Klip\n- Vask og styling"],
      ["Dameklip", "495 kr.", "", "- Klip\n- Vask og føn", true],
      ["Farve", "Fra 895 kr.", "", "- Rådgivning\n- Farve\n- Klip og føn"],
    ],
    cta: { heading: "Tid til et nyt look?", text: "Book din tid online – det tager under et minut.", button: "Book tid" },
    hours: "Tirsdag–fredag: 9–18\nLørdag: 9–14\nSøndag–mandag: Lukket",
    team: ["Frisør og indehaver", "Frisør", "Frisørelev"],
    gallery: ["unsplash:hairstyle", "unsplash:hair color salon", "unsplash:barber haircut"],
  },
  restaurant: {
    accent: "#b45309",
    font: "serif",
    background: "soft",
    hero: {
      eyebrow: "Restaurant",
      heading: "God mad, godt selskab",
      text: "Sæsonens bedste råvarer, tilberedt med omhu og serveret i hyggelige omgivelser.",
      button: "Book bord",
      image: "unsplash:restaurant dining",
    },
    servicesIntro: "Fra en hurtig frokost til den lange aften med flere retter – vi har plads til dig.",
    services: [
      ["utensils", "Frokost", "Klassiske retter og dagens ret, serveret hurtigt og frisk."],
      ["star", "Aftenmenu", "Tre eller fem retter, der følger årstiden."],
      ["users", "Selskaber", "Fejr det store eller det små med en menu skræddersyet til jer."],
      ["shopping-bag", "Take away", "Bestil hjem og nyd maden, hvor du vil."],
    ],
    about: {
      heading: "Fra jord til bord",
      text: "Vi handler lokalt og laver alt fra bunden – fra brødet om morgenen til desserten om aftenen.",
      image: "unsplash:chef cooking",
    },
    story:
      "{business} startede som en lille drøm om at lave den mad, vi selv elsker at spise.\n\nI dag er vi et køkken og en sal fuld af mennesker, der brænder for god mad og gæstfrihed. Vi glæder os til at byde dig velkommen.",
    stats: [
      ["80", "pladser"],
      ["100%", "hjemmelavet"],
      ["4,7", "i snit på Google"],
    ],
    testimonials: [
      ["Fantastisk aften med skøn mad og super service.", "Jens og Marie", "Gæster"],
      ["Vores firmafest blev perfekt. Tak for en skøn aften!", "Louise", "Selskab for 30"],
    ],
    faq: [
      ["Skal jeg bestille bord?", "Vi anbefaler det, især i weekenden. Ring eller skriv til os."],
      ["Kan I tage hensyn til allergier?", "Ja, sig til ved bestillingen, så tilpasser vi retterne."],
      ["Holder I selskaber?", "Ja, fra 10 til 60 personer. Skriv til os for en menu."],
    ],
    pricing: [
      ["Frokostmenu", "195 kr.", "pr. person", "- Dagens ret\n- Brød og smør"],
      ["3 retter", "425 kr.", "pr. person", "- Forret\n- Hovedret\n- Dessert", true],
      ["5 retter", "595 kr.", "pr. person", "- Fem retter fra sæsonen\n- Vinmenu kan tilkøbes"],
    ],
    cta: { heading: "Book et bord", text: "Vi glæder os til at se dig til frokost eller middag.", button: "Book bord" },
    hours: "Tirsdag–torsdag: 11:30–22\nFredag–lørdag: 11:30–24\nSøndag–mandag: Lukket",
    team: ["Køkkenchef", "Restaurantchef", "Tjener"],
    gallery: ["unsplash:restaurant food plate", "unsplash:wine dinner table", "unsplash:dessert plating"],
  },
  builder: {
    accent: "#1d4669",
    hero: {
      eyebrow: "Tømrer og snedker",
      heading: "Solidt håndværk – til tiden",
      text: "Om- og tilbygning, nye vinduer, køkkener og reparationer. Vi giver et fast tilbud og holder det, vi lover.",
      button: "Få et tilbud",
      image: "unsplash:carpenter construction",
    },
    servicesIntro: "Vi løser opgaver for private og virksomheder – store som små.",
    services: [
      ["home", "Om- og tilbygning", "Fra første skitse til sidste søm – vi styrer hele projektet."],
      ["hammer", "Vinduer og døre", "Udskiftning og montering, der holder varmen inde og regningen nede."],
      ["wrench", "Køkken og bad", "Montering af køkkener og indretning af bad, der holder i mange år."],
      ["shield", "Reparationer", "Hurtig hjælp til de små og store skader i hjemmet."],
    ],
    about: {
      heading: "Vi er der, når vi siger det",
      text: "Hos {business} kan du regne med en aftale. Vi møder op til tiden, rydder op efter os og holder budgettet.",
      image: "unsplash:woodworking craftsman",
    },
    story:
      "{business} er et lokalt firma med faste folk, som kender deres håndværk.\n\nVi har bygget, renoveret og repareret i området i mange år, og de fleste af vores opgaver kommer fra kunder, der anbefaler os til andre.",
    stats: [
      ["25", "års erfaring"],
      ["1.200+", "løste opgaver"],
      ["Fast", "pris på tilbud"],
    ],
    testimonials: [
      ["Professionelle folk, der holdt tidsplanen og efterlod alt pænt og ryddeligt.", "Henrik", "Tilbygning"],
      ["Hurtig hjælp, fair pris og flot arbejde.", "Birgitte", "Nye vinduer"],
    ],
    faq: [
      ["Giver I gratis tilbud?", "Ja. Vi kommer ud og ser på opgaven og giver et fast tilbud."],
      ["Hvor hurtigt kan I starte?", "Det afhænger af opgaven. Mindre opgaver kan ofte klares inden for en uge."],
      ["Kan jeg bruge håndværkerfradrag?", "Ja, på mange af vores opgaver. Vi hjælper dig gerne med det."],
    ],
    cta: { heading: "Har du en opgave?", text: "Fortæl os, hvad du har brug for, så vender vi tilbage med et tilbud.", button: "Få et tilbud" },
    hours: "Mandag–torsdag: 7–16\nFredag: 7–14",
    team: ["Tømrermester", "Tømrer", "Lærling"],
    gallery: ["unsplash:house renovation", "unsplash:wooden terrace", "unsplash:modern kitchen"],
  },
  cleaning: {
    accent: "#0f766e",
    hero: {
      eyebrow: "Rengøring",
      heading: "Et rent hjem – uden besvær",
      text: "Fast rengøring, hovedrengøring og flytterengøring. Vi kommer, når det passer dig.",
      button: "Få et tilbud",
      image: "unsplash:clean bright home",
    },
    servicesIntro: "Vi gør rent i private hjem og hos mindre virksomheder.",
    services: [
      ["home", "Fast rengøring", "Ugentlig eller hver anden uge – altid den samme, faste medarbejder."],
      ["sparkles", "Hovedrengøring", "En grundig rengøring fra top til bund, når der skal gøres ekstra rent."],
      ["truck", "Flytterengøring", "Vi sørger for, at boligen bliver afleveret, så du får dit depositum tilbage."],
      ["briefcase", "Erhverv", "Rengøring af kontorer og butikker, før eller efter åbningstid."],
    ],
    about: {
      heading: "Folk du trygt kan give nøglen",
      text: "Vores medarbejdere er faste, forsikrede og grundigt oplært, så du kan være tryg.",
      image: "unsplash:cleaning service",
    },
    story:
      "{business} startede med en enkel idé: at gøre rengøring nemt for travle familier.\n\nI dag hjælper vi mange hjem og virksomheder i området – altid med de samme faste folk og en kvalitet, du kan regne med.",
    stats: [
      ["300+", "faste kunder"],
      ["Samme", "faste medarbejder"],
      ["Fuldt", "forsikret"],
    ],
    testimonials: [
      ["Det er den bedste investering, vi har gjort. Vi har fået vores weekender tilbage.", "Familien Nielsen", "Fast rengøring"],
      ["Flytterengøringen var perfekt – vi fik hele depositummet igen.", "Emil", "Flytterengøring"],
    ],
    faq: [
      ["Kan jeg bruge servicefradrag?", "Ja, rengøring i private hjem giver servicefradrag."],
      ["Skal jeg være hjemme?", "Nej, mange giver os en nøgle. Vores medarbejdere er forsikrede."],
      ["Har I selv rengøringsmidler med?", "Ja, vi medbringer alt, og vi bruger miljøvenlige produkter."],
    ],
    pricing: [
      ["Hver anden uge", "349 kr.", "pr. time", "- Fast medarbejder\n- Rengøringsmidler inkl."],
      ["Hver uge", "329 kr.", "pr. time", "- Fast medarbejder\n- Rengøringsmidler inkl.\n- Laveste timepris", true],
      ["Flytterengøring", "Fra 2.995 kr.", "", "- Grundig rengøring\n- Afleveringsgaranti"],
    ],
    cta: { heading: "Få et uforpligtende tilbud", text: "Fortæl os lidt om dit hjem, så får du en fast pris.", button: "Få et tilbud" },
    hours: "Mandag–fredag: 7–17",
    team: ["Indehaver", "Rengøringsassistent", "Rengøringsassistent"],
  },
  fitness: {
    accent: "#ea580c",
    hero: {
      eyebrow: "Personlig træning",
      heading: "Bliv stærkere – med en plan der virker",
      text: "Personlig træning og små hold, hvor du får vejledning hele vejen. Uanset om du er nybegynder eller øvet.",
      button: "Book gratis introtime",
      image: "unsplash:personal trainer gym",
    },
    servicesIntro: "Træning tilpasset dit niveau og dine mål.",
    services: [
      ["dumbbell", "Personlig træning", "En-til-en træning med en plan, der er lavet til dig."],
      ["users", "Små hold", "Træn sammen med andre på hold med højst 6 personer."],
      ["utensils", "Kostvejledning", "Enkle råd om mad, der støtter dine mål – uden forbud."],
      ["award", "Forløb", "12-ugers forløb med test før og efter, så du kan se fremskridtet."],
    ],
    about: {
      heading: "Træning der passer ind i dit liv",
      text: "Vi bygger træningen op omkring din hverdag, så den er til at holde fast i.",
      image: "unsplash:strength training",
    },
    story:
      "{business} er for dig, der vil have resultater uden at gøre træning til et fuldtidsjob.\n\nVores trænere er uddannede og erfarne, og de holder øje med dig, så du træner rigtigt og undgår skader.",
    stats: [
      ["500+", "klienter trænet"],
      ["12", "ugers forløb"],
      ["Højst 6", "på hvert hold"],
    ],
    testimonials: [
      ["Jeg har tabt 9 kilo og er stærkere end nogensinde. Den bedste beslutning, jeg har truffet.", "Rasmus", "12-ugers forløb"],
      ["Små hold og masser af hjælp. Jeg glæder mig til hver træning.", "Julie", "Holdtræning"],
    ],
    faq: [
      ["Er det for begyndere?", "Ja. Vi tilpasser træningen til dit niveau, uanset hvor du starter."],
      ["Hvad koster en introtime?", "Den første time er gratis og uforpligtende."],
      ["Skal jeg have medlemskab et andet sted?", "Nej, du træner hos os."],
    ],
    pricing: [
      ["Små hold", "499 kr.", "pr. måned", "- 2 hold om ugen\n- Højst 6 personer"],
      ["Personlig træning", "2.995 kr.", "pr. måned", "- 4 timer med træner\n- Træningsprogram\n- Kostvejledning", true],
      ["12-ugers forløb", "7.995 kr.", "", "- 24 timer med træner\n- Test før og efter\n- Kostplan"],
    ],
    cta: { heading: "Prøv en gratis time", text: "Book en introtime, så lægger vi en plan sammen.", button: "Book introtime" },
    hours: "Mandag–fredag: 6–21\nLørdag–søndag: 8–14",
    team: ["Personlig træner", "Personlig træner", "Kostvejleder"],
    gallery: ["unsplash:gym workout", "unsplash:group fitness class", "unsplash:kettlebell training"],
  },
  lawyer: {
    accent: "#1e3a5f",
    font: "serif",
    background: "soft",
    hero: {
      eyebrow: "Advokat",
      heading: "Juridisk rådgivning i et sprog, du forstår",
      text: "Vi hjælper private og virksomheder med kontrakter, bolighandel, arv og tvister – med fast pris, når det kan lade sig gøre.",
      button: "Book et møde",
      image: "unsplash:law office",
    },
    servicesIntro: "Klar rådgivning og hurtig hjælp, når det betyder noget.",
    services: [
      ["home", "Bolighandel", "Tryg gennemgang af købsaftale og tinglysning, når du køber eller sælger."],
      ["users", "Familie og arv", "Testamenter, ægtepagter og hjælp ved dødsbo."],
      ["briefcase", "Erhverv", "Kontrakter, selskabsforhold og rådgivning til virksomheder."],
      ["shield", "Tvister", "Vi fører din sag og arbejder for den bedste løsning."],
    ],
    about: {
      heading: "Personlig rådgivning – ikke standardsvar",
      text: "Hos {business} får du en fast advokat, der kender din sag og svarer, når du ringer.",
      image: "unsplash:lawyer meeting",
    },
    story:
      "{business} er et advokatkontor med fokus på nærvær og klar kommunikation.\n\nVi tror på, at god rådgivning starter med at lytte. Derfor tager vi os tid til at forstå din situation, før vi giver et råd.",
    stats: [
      ["30", "års samlet erfaring"],
      ["Fast", "pris på mange opgaver"],
      ["24 timer", "svartid"],
    ],
    testimonials: [
      ["Professionel og forstående hjælp i en svær tid. Alt blev forklaret klart.", "Hanne", "Dødsbo"],
      ["Hurtig og skarp rådgivning til vores virksomhed.", "Thomas", "Direktør"],
    ],
    faq: [
      ["Hvad koster et første møde?", "Det første møde på 30 minutter er gratis og uforpligtende."],
      ["Arbejder I med fast pris?", "Ja, på mange opgaver. Du får altid prisen at vide på forhånd."],
      ["Kan vi holde møde online?", "Ja, vi holder gerne møder på video."],
    ],
    cta: { heading: "Book et gratis første møde", text: "Fortæl os kort om din sag, så finder vi en tid.", button: "Book et møde" },
    hours: "Mandag–fredag: 9–16",
    team: ["Advokat og partner", "Advokat", "Advokatsekretær"],
  },
  realtor: {
    accent: "#9a3412",
    hero: {
      eyebrow: "Ejendomsmægler",
      heading: "Vi sælger din bolig til den rigtige pris",
      text: "Lokalt kendskab, flotte præsentationer og en mægler, der er der for dig fra vurdering til overtagelse.",
      button: "Få en gratis vurdering",
      image: "unsplash:house exterior",
    },
    servicesIntro: "Alt du har brug for, når du skal sælge eller købe.",
    services: [
      ["home", "Salg af bolig", "Vi står for hele salget – fra fotos og annoncer til fremvisninger og forhandling."],
      ["star", "Gratis vurdering", "Få et realistisk bud på, hvad din bolig er værd i dag."],
      ["camera", "Professionelle fotos", "Flotte billeder og plantegning, der får din bolig til at skille sig ud."],
      ["users", "Køberrådgivning", "Vi hjælper dig med at finde og købe det rette hjem."],
    ],
    about: {
      heading: "Vi kender området",
      text: "Vi bor og arbejder i lokalområdet, så vi ved, hvad købere efterspørger – og hvad de vil betale.",
      image: "unsplash:real estate agent",
    },
    story:
      "{business} er en lokal mæglerforretning med kort vej til mægleren.\n\nVi har solgt boliger i området i mange år, og vi går op i, at både sælger og køber får en god oplevelse.",
    stats: [
      ["600+", "solgte boliger"],
      ["45", "dage i snit til salg"],
      ["4,9", "i snit på Google"],
    ],
    testimonials: [
      ["Solgt på tre uger og til mere end forventet. Kan varmt anbefales!", "Karina og Søren", "Solgte rækkehus"],
      ["Tryg proces og altid hurtigt svar.", "Bent", "Solgte villa"],
    ],
    faq: [
      ["Hvad koster en vurdering?", "Den er gratis og uforpligtende."],
      ["Hvor lang tid tager et salg?", "I gennemsnit 45 dage, men det afhænger af bolig og marked."],
      ["Hvad koster det at sælge?", "Du får et fast salær på forhånd, så der er ingen overraskelser."],
    ],
    cta: { heading: "Hvad er din bolig værd?", text: "Book en gratis vurdering – vi kommer ud til dig.", button: "Få en vurdering" },
    hours: "Mandag–torsdag: 9–17\nFredag: 9–16\nWeekend: Efter aftale",
    team: ["Statsautoriseret ejendomsmægler", "Ejendomsmægler", "Sagsbehandler"],
    gallery: ["unsplash:modern living room", "unsplash:scandinavian house", "unsplash:bright kitchen interior"],
  },
  garage: {
    accent: "#b91c1c",
    hero: {
      eyebrow: "Autoværksted",
      heading: "Service og reparation til alle bilmærker",
      text: "Faste priser, ærlige råd og bilen klar, når vi har lovet det. Fabriksgarantien holder også.",
      button: "Book service",
      image: "unsplash:car mechanic",
    },
    servicesIntro: "Vi servicerer og reparerer alle bilmærker – også nyere biler med garanti.",
    services: [
      ["wrench", "Service", "Service efter fabrikkens forskrifter, så du beholder garantien."],
      ["car", "Reparationer", "Bremser, kobling, udstødning og meget mere – med pris på forhånd."],
      ["shield", "Syn", "Vi klargør bilen og kører den til syn for dig."],
      ["zap", "Fejlfinding", "Moderne diagnoseudstyr, der finder fejlen hurtigt."],
    ],
    about: {
      heading: "Et værksted du kan stole på",
      text: "Vi ringer, før vi laver noget, der ikke er aftalt. Så er der aldrig overraskelser på regningen.",
      image: "unsplash:auto repair shop",
    },
    story:
      "{business} er et lokalt værksted med faguddannede mekanikere og moderne udstyr.\n\nVi behandler din bil, som var den vores egen, og vi giver dig altid et ærligt råd om, hvad der er nødvendigt – og hvad der kan vente.",
    stats: [
      ["30", "års erfaring"],
      ["Alle", "bilmærker"],
      ["Lånebil", "til rådighed"],
    ],
    testimonials: [
      ["Fair priser, og de forklarer, hvad der skal laves. Mit faste værksted.", "Morten", "Kunde i 10 år"],
      ["Bilen var klar samme dag, som lovet.", "Pia", "Service"],
    ],
    faq: [
      ["Mister jeg fabriksgarantien?", "Nej. Vi laver service efter fabrikkens forskrifter, så garantien holder."],
      ["Kan jeg låne en bil?", "Ja, sig til når du booker, så har vi en lånebil klar."],
      ["Hvad koster en service?", "Det afhænger af bilen. Du får en fast pris, når du booker."],
    ],
    pricing: [
      ["Lille service", "Fra 1.495 kr.", "", "- Olieskift\n- Gennemgang af bilen"],
      ["Stor service", "Fra 2.995 kr.", "", "- Efter fabrikkens forskrifter\n- Garantien holder", true],
      ["Klargøring til syn", "Fra 795 kr.", "", "- Gennemgang\n- Vi kører bilen til syn"],
    ],
    cta: { heading: "Book service eller reparation", text: "Fortæl os om din bil, så finder vi en tid.", button: "Book tid" },
    hours: "Mandag–torsdag: 7–16\nFredag: 7–14",
    team: ["Værkstedsejer", "Mekaniker", "Mekaniker"],
  },
  massage: {
    accent: "#a16207",
    background: "soft",
    hero: {
      eyebrow: "Massage og behandling",
      heading: "Giv din krop en pause",
      text: "Afslappende og behandlende massage, der løsner spændinger og giver ny energi.",
      button: "Book behandling",
      image: "unsplash:massage therapy",
    },
    servicesIntro: "Behandlinger til både krop og sind.",
    services: [
      ["leaf", "Afspændende massage", "En rolig massage, der løsner op og giver ro i kroppen."],
      ["heart", "Sportsmassage", "Dybere massage til muskler, der arbejder hårdt."],
      ["sparkles", "Ansigtsbehandling", "Rens, pleje og afslapning for huden."],
      ["star", "Gavekort", "Giv en, du holder af, en pause i hverdagen."],
    ],
    about: {
      heading: "Et rum til ro",
      text: "Hos {business} er der stille, varmt og god tid. Du skal bare slappe af – vi klarer resten.",
      image: "unsplash:spa relaxation",
    },
    story:
      "{business} er skabt som et sted, hvor du kan lade op.\n\nVores behandlere er uddannede og erfarne, og hver behandling tilpasses det, din krop har brug for netop i dag.",
    stats: [
      ["10", "års erfaring"],
      ["3.000+", "behandlinger"],
      ["5,0", "i snit på Google"],
    ],
    testimonials: [
      ["Den bedste massage, jeg har fået. Jeg gik derfra som et nyt menneske.", "Lone", "Afspændende massage"],
      ["Endelig hjælp til mine stive skuldre.", "Kasper", "Sportsmassage"],
    ],
    faq: [
      ["Hvad skal jeg have med?", "Ingenting. Vi har håndklæder og alt, du skal bruge."],
      ["Kan jeg købe et gavekort?", "Ja, gavekort kan købes i klinikken eller bestilles her på siden."],
      ["Får jeg tilskud?", "Har du en sundhedsforsikring, kan du ofte få tilskud. Spørg dit forsikringsselskab."],
    ],
    pricing: [
      ["30 minutter", "395 kr.", "", "- Ryg, nakke og skuldre"],
      ["60 minutter", "650 kr.", "", "- Hele kroppen\n- Tid til fordybelse", true],
      ["90 minutter", "895 kr.", "", "- Hele kroppen\n- Ansigt og fødder"],
    ],
    cta: { heading: "Book din behandling", text: "Find en tid, der passer dig – også om aftenen.", button: "Book behandling" },
    hours: "Mandag–fredag: 9–20\nLørdag: 10–15",
    team: ["Massør og indehaver", "Massør"],
  },
  consultant: {
    accent: "#4338ca",
    hero: {
      eyebrow: "Rådgivning",
      heading: "Klarhed, plan og fremdrift i din virksomhed",
      text: "Jeg hjælper ejere af små og mellemstore virksomheder med at træffe de rigtige beslutninger – og få dem gennemført.",
      button: "Book et møde",
      image: "unsplash:business meeting",
    },
    servicesIntro: "Rådgivning, der er til at handle på.",
    services: [
      ["briefcase", "Strategi", "Vi lægger en klar plan for de næste 12 måneder – med mål, du kan måle."],
      ["users", "Ledelse", "Sparring til dig som leder, så du får teamet med."],
      ["zap", "Vækst", "Find de muligheder, der giver mest for indsatsen."],
      ["calendar", "Løbende sparring", "Faste møder, der holder dig på sporet."],
    ],
    about: {
      heading: "Erfaring fra virkeligheden",
      text: "Jeg har selv drevet virksomhed og ved, hvor svært det er at nå det hele. Derfor er min rådgivning praktisk og konkret.",
      image: "unsplash:consultant workshop",
    },
    story:
      "{business} hjælper virksomheder med at få overblik og fremdrift.\n\nMed mange års erfaring som både leder og rådgiver ved jeg, at de bedste planer er dem, der bliver ført ud i livet. Derfor følger jeg dig hele vejen.",
    stats: [
      ["100+", "virksomheder hjulpet"],
      ["20", "års erfaring"],
      ["Gratis", "første møde"],
    ],
    testimonials: [
      ["På tre måneder fik vi skabt mere fremdrift end det seneste år.", "Lene", "Direktør"],
      ["Skarp, ærlig og meget praktisk sparring.", "Mads", "Indehaver"],
    ],
    faq: [
      ["Hvordan foregår et forløb?", "Vi starter med et gratis møde, hvor vi afklarer dine behov. Derefter får du et forslag til forløb og pris."],
      ["Kan vi mødes online?", "Ja, både online og fysisk."],
      ["Hvilke virksomheder hjælper du?", "Primært ejerledede virksomheder med 2–50 ansatte."],
    ],
    pricing: [
      ["Strategidag", "9.500 kr.", "", "- En hel dag\n- Skriftlig plan"],
      ["Forløb", "4.500 kr.", "pr. måned", "- To møder om måneden\n- Sparring ind imellem", true],
      ["Enkeltmøde", "1.500 kr.", "pr. time", "- Sparring på en konkret udfordring"],
    ],
    cta: { heading: "Lad os tage en snak", text: "Book et gratis og uforpligtende møde på 30 minutter.", button: "Book et møde" },
    hours: "Mandag–fredag: 8–17",
    team: ["Rådgiver og ejer"],
  },
} satisfies Record<string, Copy>;

export type WebsiteTemplateId = keyof typeof COPY;

/** The website templates, as shown in "New page". */
export const WEBSITE_TEMPLATES: { id: `site-${WebsiteTemplateId}`; name: string; icon: ServiceIcon }[] = [
  { id: "site-dentist", name: "Dentist", icon: "smile" },
  { id: "site-physio", name: "Physiotherapist", icon: "stethoscope" },
  { id: "site-hairdresser", name: "Hairdresser", icon: "scissors" },
  { id: "site-restaurant", name: "Restaurant or café", icon: "utensils" },
  { id: "site-builder", name: "Builder or carpenter", icon: "hammer" },
  { id: "site-cleaning", name: "Cleaning", icon: "sparkles" },
  { id: "site-fitness", name: "Fitness or personal trainer", icon: "dumbbell" },
  { id: "site-lawyer", name: "Lawyer or accountant", icon: "briefcase" },
  { id: "site-realtor", name: "Estate agent", icon: "home" },
  { id: "site-garage", name: "Car garage", icon: "car" },
  { id: "site-massage", name: "Massage or wellness", icon: "leaf" },
  { id: "site-consultant", name: "Consultant or coach", icon: "users" },
];

export function isWebsiteTemplate(id: string): id is `site-${WebsiteTemplateId}` {
  return WEBSITE_TEMPLATES.some((t) => t.id === id);
}

/** Everything a four-page website is built from. Empty lists leave their section out. */
export type SiteContent = {
  businessName: string;
  accent: string;
  font: "sans" | "serif";
  background: "white" | "soft";
  hero: { eyebrow: string; heading: string; text: string; button: string; image: string };
  servicesIntro: string;
  services: { icon: ServiceIcon; title: string; text: string }[];
  about: { heading: string; text: string; image: string };
  story: string;
  storyImage: string;
  stats: { value: string; label: string }[];
  testimonials: { quote: string; name: string; role: string }[];
  faq: { question: string; answer: string }[];
  pricing: { name: string; price: string; period: string; features: string; highlighted: boolean }[];
  cta: { heading: string; text: string; button: string };
  contact: { address: string; phone: string; email: string; openingHours: string };
  footerText: string;
  team: { name: string; role: string }[];
  gallery: string[];
};

/** A template's starter copy for `businessName`. */
export function templateContent(template: WebsiteTemplateId, businessName: string): SiteContent {
  const copy: Copy = COPY[template];
  const name = businessName.trim() || "Din virksomhed";
  const fill = (text: string) => text.replaceAll("{business}", name);
  return {
    businessName: name,
    accent: copy.accent,
    font: copy.font ?? "sans",
    background: copy.background ?? "white",
    hero: { ...copy.hero, heading: fill(copy.hero.heading), text: fill(copy.hero.text) },
    servicesIntro: copy.servicesIntro,
    services: copy.services.map(([icon, title, text]) => ({ icon, title, text })),
    about: { heading: fill(copy.about.heading), text: fill(copy.about.text), image: copy.about.image },
    story: fill(copy.story),
    storyImage: copy.about.image.replace(STOCK, `${STOCK}team `),
    stats: copy.stats.map(([value, label]) => ({ value, label })),
    testimonials: copy.testimonials.map(([quote, person, role]) => ({ quote, name: person, role })),
    faq: copy.faq.map(([question, answer]) => ({ question, answer })),
    pricing: (copy.pricing ?? []).map(([planName, price, period, features, highlighted]) => ({
      name: planName,
      price,
      period,
      features,
      highlighted: Boolean(highlighted),
    })),
    cta: copy.cta,
    contact: { address: "Adressevej 1\n1234 By", phone: "12 34 56 78", email: "kontakt@dit-domaene.dk", openingHours: copy.hours },
    footerText: `${name}\nAdressevej 1, 1234 By\nCVR 12345678`,
    team: copy.team.map((role) => ({ name: "Navn Efternavn", role })),
    gallery: copy.gallery ?? [],
  };
}

/** Builds a template's four-page website for `businessName`. Form blocks are filled in by the caller. */
export function buildWebsite(template: WebsiteTemplateId, businessName: string): FunnelDoc {
  return buildSite(templateContent(template, businessName), "da");
}

function make<T extends Block["type"]>(type: T, language: Language, overrides: Partial<Extract<Block, { type: T }>>) {
  return { ...newBlock(type, language), ...overrides } as Extract<Block, { type: T }>;
}

/** Lays content out as four pages (front page, services, about, contact) with a menu and footer. */
export function buildSite(content: SiteContent, language: Language): FunnelDoc {
  const t = (danish: string, english: string) => (language === "da" ? danish : english);
  const name = content.businessName.trim() || t("Din virksomhed", "Your business");

  const home = newStep(t("Forside", "Home"), t("forside", "home"));
  const services = newStep(t("Ydelser", "Services"), t("ydelser", "services"));
  const about = newStep(t("Om os", "About us"), t("om-os", "about"));
  const contact = newStep(t("Kontakt", "Contact"), t("kontakt", "contact"));
  const toContact = { target: "step" as const, stepId: contact.id, url: "" };

  const features = (heading: string, text: string, columns: 2 | 3) =>
    make("features", language, { heading, text, columns, items: content.services.slice(0, 12) });
  const stats = () => (content.stats.length ? [make("stats", language, { heading: "", items: content.stats.slice(0, 6) })] : []);
  const cta = () => make("cta", language, { heading: content.cta.heading, text: content.cta.text, buttonLabel: content.cta.button, button: toContact });

  home.blocks = [
    make("hero", language, {
      eyebrow: content.hero.eyebrow,
      heading: content.hero.heading,
      text: content.hero.text,
      buttonLabel: content.hero.button,
      button: toContact,
      imageUrl: content.hero.image,
      layout: "background",
    }),
    ...stats(),
    ...(content.services.length
      ? [features(t("Det hjælper vi med", "How we can help"), content.servicesIntro, content.services.length % 3 === 0 ? 3 : 2)]
      : []),
    make("split", language, {
      heading: content.about.heading,
      text: content.about.text,
      imageUrl: content.about.image,
      imageSide: "right",
      buttonLabel: t("Læs mere om os", "More about us"),
      button: { target: "step", stepId: about.id, url: "" },
    }),
    ...(content.testimonials.length
      ? [make("testimonials", language, { heading: t("Det siger vores kunder", "What our customers say"), items: content.testimonials.slice(0, 12) })]
      : []),
    cta(),
  ];

  services.blocks = [
    make("text", language, { heading: t("Vores ydelser", "Our services"), text: content.servicesIntro, align: "center" }),
    ...(content.services.length ? [features("", "", 2)] : []),
    ...(content.pricing.length
      ? [
          make("pricing", language, {
            heading: t("Priser", "Prices"),
            text: "",
            plans: content.pricing.slice(0, 4).map((plan) => ({
              ...plan,
              description: "",
              buttonLabel: content.cta.button,
              button: toContact,
            })),
          }),
        ]
      : []),
    ...(content.faq.length ? [make("faq", language, { heading: t("Ofte stillede spørgsmål", "Questions and answers"), items: content.faq.slice(0, 20) })] : []),
    cta(),
  ];

  about.blocks = [
    make("split", language, { heading: t(`Om ${name}`, `About ${name}`), text: content.story, imageUrl: content.storyImage, imageSide: "left" }),
    ...(content.team.length
      ? [make("team", language, { heading: t("Mød os", "Meet the team"), text: "", people: content.team.slice(0, 16).map((p) => ({ ...p, photoUrl: "", bio: "" })) })]
      : []),
    ...(content.gallery.length ? [make("gallery", language, { heading: "", columns: 3, images: content.gallery.slice(0, 24).map((url) => ({ url, alt: "" })) })] : []),
    ...stats(),
  ];

  contact.blocks = [
    make("contact", language, {
      heading: t("Kontakt os", "Get in touch"),
      text: content.cta.text,
      ...content.contact,
      showMap: Boolean(content.contact.address.trim()),
      formId: null,
    }),
  ];

  return {
    version: 1,
    language,
    indexable: true,
    theme: { accent: content.accent, background: content.background, font: content.font },
    site: siteSchema.parse({
      header: { enabled: true, businessName: name, buttonLabel: content.hero.button, button: toContact },
      footer: { enabled: true, text: content.footerText, phone: content.contact.phone, email: content.contact.email },
    }),
    photoCredits: [],
    steps: [home, services, about, contact],
  };
}

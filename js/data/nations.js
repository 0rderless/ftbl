// Nationalities and fictional name pools for generated players.

const POOLS = {
  en: {
    first: ['James', 'Harry', 'Jack', 'Oliver', 'George', 'Charlie', 'Thomas', 'Leo', 'Alfie', 'Freddie', 'Archie', 'Ethan', 'Mason', 'Callum', 'Reece', 'Jordan', 'Kieran', 'Declan', 'Connor', 'Lewis', 'Tyler', 'Ryan', 'Ben', 'Sam', 'Joe', 'Luke', 'Aaron', 'Owen', 'Rhys', 'Jamie'],
    last: ['Ashworth', 'Blackwood', 'Carver', 'Dunmore', 'Ellison', 'Fairley', 'Garnett', 'Holloway', 'Ingram', 'Jessop', 'Kershaw', 'Lockhart', 'Marsden', 'Newbold', 'Oakes', 'Pennington', 'Quarrie', 'Radley', 'Shelton', 'Thorne', 'Upton', 'Varley', 'Whitlock', 'Yardley', 'Bramwell', 'Cotterill', 'Hatcher', 'Lowther', 'Pickford', 'Stannard', 'Wragg', 'Hollins'],
  },
  es: {
    first: ['Alejandro', 'Pablo', 'Diego', 'Sergio', 'Javier', 'Marcos', 'Adrián', 'Álvaro', 'Iker', 'Hugo', 'Mateo', 'Rodrigo', 'Nicolás', 'Santiago', 'Tomás', 'Joaquín', 'Lucas', 'Gonzalo', 'Raúl', 'Unai'],
    last: ['Arriaga', 'Benítez', 'Castaño', 'Domínguez', 'Escudero', 'Ferrán', 'Galindo', 'Herrera', 'Iglesias', 'Jurado', 'Lozano', 'Medina', 'Navarro', 'Ortega', 'Pizarro', 'Quintero', 'Robledo', 'Salcedo', 'Toledo', 'Valverde', 'Zamora', 'Cordero'],
  },
  pt: {
    first: ['João', 'Rafael', 'Tiago', 'Gonçalo', 'Bruno', 'Diogo', 'Rúben', 'Gabriel', 'Lucas', 'Matheus', 'Vinícius', 'Thiago', 'Felipe', 'Caio', 'Murilo', 'Renan', 'Igor', 'André'],
    last: ['Albuquerque', 'Barros', 'Cardoso', 'Duarte', 'Esteves', 'Figueira', 'Gouveia', 'Lacerda', 'Macedo', 'Nogueira', 'Pacheco', 'Queiroz', 'Rebelo', 'Sardinha', 'Teixeira', 'Valadares', 'Moura', 'Coutinho'],
  },
  fr: {
    first: ['Antoine', 'Hugo', 'Théo', 'Lucas', 'Mathis', 'Enzo', 'Louis', 'Nathan', 'Maxime', 'Kylian', 'Baptiste', 'Clément', 'Yanis', 'Rayan', 'Adrien', 'Florian', 'Julien', 'Quentin'],
    last: ['Arnaud', 'Bertin', 'Chauvet', 'Delorme', 'Esnault', 'Faure', 'Garnier', 'Hébert', 'Lacombe', 'Marchand', 'Noël', 'Perrin', 'Roussel', 'Sauvage', 'Tessier', 'Vasseur', 'Lemaire', 'Bonnet'],
  },
  it: {
    first: ['Lorenzo', 'Matteo', 'Alessandro', 'Davide', 'Federico', 'Riccardo', 'Gianluca', 'Nicolò', 'Simone', 'Andrea', 'Marco', 'Stefano', 'Daniele', 'Pietro', 'Tommaso'],
    last: ['Bellandi', 'Castellano', 'De Santis', 'Ferraro', 'Galli', 'Lombardo', 'Mancuso', 'Orsini', 'Pellegrini', 'Rinaldi', 'Serafini', 'Tedesco', 'Valentini', 'Zanetti', 'Morelli', 'Vitale'],
  },
  de: {
    first: ['Lukas', 'Jonas', 'Leon', 'Felix', 'Maximilian', 'Niklas', 'Tim', 'Florian', 'Jannik', 'Moritz', 'Paul', 'Kai', 'Timo', 'Julian', 'Sebastian', 'Fabian'],
    last: ['Achterberg', 'Brandt', 'Dietrich', 'Eberhardt', 'Falkner', 'Gebhardt', 'Hartwig', 'Kessler', 'Lindner', 'Möller', 'Neumann', 'Pfeiffer', 'Reinholt', 'Schreiber', 'Vogt', 'Wendland', 'Ziegler'],
  },
  nl: {
    first: ['Daan', 'Sem', 'Bram', 'Lars', 'Thijs', 'Ruben', 'Stijn', 'Jesse', 'Milan', 'Joris', 'Wout', 'Jelle', 'Koen', 'Niels'],
    last: ['Bakker', 'de Graaf', 'van Dijkstra', 'Hendriks', 'Jansen', 'Kuipers', 'Mulder', 'van Rooij', 'Smit', 'Verbeek', 'Visser', 'de Wit', 'Brouwer', 'Postma'],
  },
  nord: {
    first: ['Erik', 'Magnus', 'Oskar', 'Anders', 'Viktor', 'Emil', 'Henrik', 'Sindre', 'Mikkel', 'Rasmus', 'Jonas', 'Elias', 'Aksel', 'Sander'],
    last: ['Andersen', 'Berg', 'Dahl', 'Eriksson', 'Fjeld', 'Halvorsen', 'Lindqvist', 'Nygaard', 'Olsen', 'Sundberg', 'Strand', 'Holm', 'Lund', 'Vik'],
  },
  slav: {
    first: ['Luka', 'Marko', 'Ivan', 'Nikola', 'Dejan', 'Filip', 'Mateusz', 'Jakub', 'Tomas', 'Petr', 'Dominik', 'Bartosz', 'Stefan', 'Aleksandar'],
    last: ['Babić', 'Horvat', 'Jovanović', 'Kovač', 'Marić', 'Novak', 'Petrović', 'Kowalczyk', 'Zieliński', 'Dvořák', 'Šimić', 'Vuković', 'Nowicki', 'Lazić'],
  },
  waf: {
    first: ['Kwame', 'Kofi', 'Yaw', 'Emeka', 'Chidi', 'Ousmane', 'Mamadou', 'Ibrahima', 'Sadio', 'Moussa', 'Seydou', 'Ademola', 'Tunde', 'Abdou'],
    last: ['Adeyemi', 'Boateng', 'Diallo', 'Mensah', 'Okafor', 'Traoré', 'Ndiaye', 'Asante', 'Koné', 'Owusu', 'Sissoko', 'Eze', 'Bamba', 'Camara'],
  },
  ar: {
    first: ['Youssef', 'Omar', 'Karim', 'Hamza', 'Bilal', 'Amine', 'Rachid', 'Tarek', 'Ayoub', 'Mehdi', 'Nabil', 'Sofiane'],
    last: ['Benali', 'El Amrani', 'Haddad', 'Mansour', 'Saidi', 'Belkacem', 'Zaher', 'Rahmani', 'Fakhri', 'Toumi', 'Bouzid', 'Chraibi'],
  },
  tr: {
    first: ['Emre', 'Burak', 'Arda', 'Kerem', 'Mert', 'Can', 'Ozan', 'Cengiz', 'Hakan', 'Yusuf'],
    last: ['Aksoy', 'Demirci', 'Erdem', 'Kaya', 'Öztürk', 'Şahin', 'Yıldız', 'Korkmaz', 'Çelik', 'Aydın'],
  },
  jp: {
    first: ['Takumi', 'Kaoru', 'Daichi', 'Ritsu', 'Hiroki', 'Kento', 'Yuto', 'Sota', 'Haruto', 'Ren'],
    last: ['Sakamoto', 'Kobayashi', 'Matsuda', 'Nakajima', 'Ishikawa', 'Fujita', 'Okada', 'Hayashi', 'Mori', 'Ueda'],
  },
  kr: {
    first: ['Min-jae', 'Seung-ho', 'Ji-hoon', 'Hyun-woo', 'Dong-hyun', 'Jae-sung', 'Woo-jin', 'Tae-yang'],
    last: ['Kim', 'Lee', 'Park', 'Choi', 'Jung', 'Kang', 'Yoon', 'Han'],
  },
  latam: {
    first: ['Juan', 'Mateo', 'Santiago', 'Facundo', 'Emiliano', 'Thiago', 'Agustín', 'Valentín', 'Nahuel', 'Franco', 'Bautista', 'Julián', 'Cristian', 'Brian'],
    last: ['Acosta', 'Benedetto', 'Cabrera', 'Ferreyra', 'Gómez', 'Ibarra', 'Londoño', 'Montiel', 'Paredes', 'Quiroga', 'Ríos', 'Sosa', 'Valdivia', 'Zuñiga'],
  },
};

export const NATIONS = [
  ['ENG', 'England', '\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}', 'en'], ['SCO', 'Scotland', '\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}', 'en'], ['WAL', 'Wales', '\u{1F3F4}\u{E0067}\u{E0062}\u{E0077}\u{E006C}\u{E0073}\u{E007F}', 'en'], ['IRL', 'Ireland', '🇮🇪', 'en'],
  ['USA', 'United States', '🇺🇸', 'en'], ['CAN', 'Canada', '🇨🇦', 'en'], ['AUS', 'Australia', '🇦🇺', 'en'],
  ['ESP', 'Spain', '🇪🇸', 'es'], ['MEX', 'Mexico', '🇲🇽', 'latam'], ['ARG', 'Argentina', '🇦🇷', 'latam'], ['URU', 'Uruguay', '🇺🇾', 'latam'],
  ['COL', 'Colombia', '🇨🇴', 'latam'], ['CHI', 'Chile', '🇨🇱', 'latam'], ['POR', 'Portugal', '🇵🇹', 'pt'], ['BRA', 'Brazil', '🇧🇷', 'pt'],
  ['FRA', 'France', '🇫🇷', 'fr'], ['BEL', 'Belgium', '🇧🇪', 'fr'], ['SUI', 'Switzerland', '🇨🇭', 'de'], ['ITA', 'Italy', '🇮🇹', 'it'],
  ['GER', 'Germany', '🇩🇪', 'de'], ['AUT', 'Austria', '🇦🇹', 'de'], ['NED', 'Netherlands', '🇳🇱', 'nl'], ['DEN', 'Denmark', '🇩🇰', 'nord'],
  ['NOR', 'Norway', '🇳🇴', 'nord'], ['SWE', 'Sweden', '🇸🇪', 'nord'], ['CRO', 'Croatia', '🇭🇷', 'slav'], ['SRB', 'Serbia', '🇷🇸', 'slav'],
  ['POL', 'Poland', '🇵🇱', 'slav'], ['CZE', 'Czechia', '🇨🇿', 'slav'], ['GHA', 'Ghana', '🇬🇭', 'waf'], ['NGA', 'Nigeria', '🇳🇬', 'waf'],
  ['SEN', 'Senegal', '🇸🇳', 'waf'], ['CIV', "Côte d'Ivoire", '🇨🇮', 'waf'], ['MLI', 'Mali', '🇲🇱', 'waf'], ['CMR', 'Cameroon', '🇨🇲', 'waf'],
  ['MAR', 'Morocco', '🇲🇦', 'ar'], ['ALG', 'Algeria', '🇩🇿', 'ar'], ['EGY', 'Egypt', '🇪🇬', 'ar'], ['TUN', 'Tunisia', '🇹🇳', 'ar'],
  ['TUR', 'Türkiye', '🇹🇷', 'tr'], ['JPN', 'Japan', '🇯🇵', 'jp'], ['KOR', 'South Korea', '🇰🇷', 'kr'],
  ['GEK', 'Geko', '🦎', 'en'],
].map(([code, name, flag, pool]) => ({ code, name, flag, pool }));

export const NATION_BY_CODE = Object.fromEntries(NATIONS.map((n) => [n.code, n]));

export function nationFlag(code) {
  const n = NATION_BY_CODE[code];
  return n ? n.flag : '🏳️';
}
export function nationName(code) {
  const n = NATION_BY_CODE[code];
  return n ? n.name : code || 'Unknown';
}

export function randomName(rng, nationCode) {
  const n = NATION_BY_CODE[nationCode] || NATIONS[0];
  const pool = POOLS[n.pool] || POOLS.en;
  return `${rng.pick(pool.first)} ${rng.pick(pool.last)}`;
}

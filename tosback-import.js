import fsApi from 'fs';
import path from 'path';
// eslint-disable-next-line import/no-extraneous-dependencies
import parser from 'xml2json';
// eslint-disable-next-line import/no-extraneous-dependencies
import xPathToCss from 'xpath-to-css';
import simpleGit from 'simple-git';
import { createRequire } from 'module';
// eslint-disable-next-line import/no-extraneous-dependencies
import pg from 'pg';
// eslint-disable-next-line import/no-extraneous-dependencies
import pQueue from 'p-queue';
import { assertValid, validateDocument } from './validator.js';
import serviceSchema from './service.schema.js';
import filter from '../CGUs/src/app/filter/index.js';

const PQueue = pQueue.default;
// console.log(PQueue);

// FIXME: Somehow Node.js ESM doesn't recognize this export:
//
// import { Client } from 'pg';
// ^^^^^^
// SyntaxError: The requested module 'pg' does not provide an export named 'Client'
//
// But it does work:
const { Client } = pg;

const require = createRequire(import.meta.url);
const TYPES = require('./types.json');

const fs = fsApi.promises;

const SERVICES_PATH = '../CGUs/services/';
const SERVICES_INVALID_PATH = './servicesInvalid/';
const SERVICES_UNKNOWN_TYPE_PATH = './servicesUnknownType/';
const LOCAL_TOSBACK2_REPO = (process.env.LAPTOP ? '../../tosdr/tosback2' : '../tosback2');
const TOSBACK2_WEB_ROOT = 'https://github.com/tosdr/tosback2';
const BRANCH_TO_USE = 'all-file-paths';
const TOSBACK2_RULES_FOLDER_NAME = 'rules';
const TOSBACK2_CRAWLS_FOLDER_NAME_1 = 'crawl_reviewed';
const TOSBACK2_CRAWLS_FOLDER_NAME_2 = 'crawl';
const POSTGRES_URL = process.env.DATABASE_URL || 'postgres://localhost/phoenix_development';
const THREADS = 5;
const SNAPSHOTS_PATH = (process.env.LAPTOP ? '../CGUs/data/snapshots/' : '../CGUs-snapshots/');
const VERSIONS_PATH = (process.env.LAPTOP ? '../CGUs/data/versions/' : '../CGUs-versions/');

const services = {};
const servicesInvalid = {};
const servicesUnknownType = {};
const urlAlreadyCovered = {};

const HTML_PREFIX = '<!DOCTYPE html><html><head></head><body>\n';
const HTML_SUFFIX = '\n</body></html>';

const typesMap = {
  'Acceptable Use Policy for Xfinity Internet': 'Acceptable Use Policy',
  'Agreement': 'Terms of Service',
  'Amazon Privacy Notice': 'Privacy Policy',
  'API Terms of Use': 'Developer Terms',
  'APIs Terms of Use': 'Developer Terms',
  'Acceptable Use Policy': 'Terms of Service',
  'All Policies': 'Terms of Service',
  'Application-Based Services Terms of Use': 'Terms of Service',
  'Cable Internet Terms of Use': 'Terms of Service',
  'Canary Privacy Policy': 'Privacy Policy',
  'Cbs Interactive Privacy Policy': 'Privacy Policy',
  'Closed Captioning Policy': 'Closed Captioning Policy',
  'Conditions of Use': 'Terms of Service',
  'Consumer Terms of Sale': 'Terms of Service',
  'Cookie Policy': 'Cookies Policy',
  'Cookies and Privacy Policy - About Privacy': 'Privacy Policy',
  'Copyright and Your use of the British Library Website': 'Terms of Service',
  'Customer Privacy Policy': 'Privacy Policy',
  DMCA: 'Copyright Policy',
  'Data Policy': 'Privacy Policy',
  'Data Use Policy': 'Privacy Policy',
  EULA: 'Terms of Service',
  'Software License Agreement': 'Terms of Service',
  'Etiquette Policy': 'Community Guidelines',
  'Flickr Privacy Policy': 'Privacy Policy',
  'GOOGLE PRIVACY POLICY': 'Privacy Policy',
  'Gizmo Privacy Policy': 'Privacy Policy',
  'Host Guarantee Terms and Conditions': 'Seller Warranty',
  'Intellectual Property': 'Copyright Claims Policy',
  'Intellectual Property Policy': 'Copyright Claims Policy',
  'Internet Terms of Service': 'Terms of Service',
  'Legal Info': 'Legal Information',
  'Legal Information (Intuit)': 'Legal Information',
  'Legal Notices': 'Legal Information',
  'LinkedIn in Microsoft Applications with Your Personal Account': 'Single Sign-On Policy',
  'Microsoft Services Agreement': 'Terms of Service',
  'Microsoft Terms of Use': 'Terms of Service',
  'Oath Privacy Center': 'Privacy Policy',
  'PRIVACY POLICY': 'Privacy Policy',
  Privacy: 'Privacy Policy',
  'Privacy Notice': 'Privacy Policy',
  'Privacy Statement': 'Privacy Policy',
  'Privacy Policy Agreement': 'Privacy Policy',
  'Privacy Policy and Terms of Use': 'Terms of Service',
  'Privacy and Cookies Policy': 'Privacy Policy',
  'Privacy for eero Devices': 'Privacy Policy',
  'Rules on Resolving Image Piracy Complaints': 'Copyright Claims Policy',
  'SAMSUNG PRIVACY POLICY FOR THE U.S.': 'Privacy Policy',
  Security: 'Vulnerability Disclosure Policy',
  'Security & Privacy': 'Privacy Policy',
  'Security Advisory': 'Vulnerability Disclosure Policy',
  'Signal Terms & Privacy Policy': 'Terms of Service',
  'Term of Service': 'Terms of Service',
  Terms: 'Terms of Service',
  'Terms & Conditions': 'Terms of Service',
  'Terms and Conditions': 'Terms of Service',
  'Terms of Use': 'Terms of Service',
  'Terms Of Use': 'Terms of Service',
  'Terms and Conditions and Privacy Policy': 'Terms of Service',
  'Terms and Conditions of Use': 'Terms of Service',
  'Terms of Sale': 'Terms of Service',
  'Terms of Service & Privacy Policy': 'Terms of Service',
  'Terms of Service 1': 'Terms of Service',
  'Terms of Service and License Agreement': 'Terms of Service',
  'Terms of Service and Privacy': 'Terms of Service',
  'Terms of Use (Consumer)': 'Terms of Service',
  'Terms of Use - About Copyright': 'Terms of Service',
  'Terms of Use and Privacy Policy': 'Terms of Service',
  '"Third Party Advertising': ' Third Party Cookies',
  'Universal Terms Of Service': 'Terms of Service',
  'Use Agreement': 'Terms of Service',
  'Visitor Agreement': 'Terms of Service',
  'Vunerability Disclosure Program': 'Vulnerability Disclosure Policy',
  'Web Notices and Terms of Use': 'Terms of Service',
  'Website Terms of Service': 'Terms of Service',
  'World Of Warcraft Terms Of Use Agreement': 'Terms of Service',
  'YOUR PRIVACY & SECURITY': 'Privacy Policy',
  'end-user-license-agreement': 'Terms of Service'
};
const subServices = {
  'Alexa': 'Alexa',
  'Amazon App Suite': 'AppSuite',
  'Amazon Appstore for Android': 'AmazonAppStoreAndroid',
  'Amazon Appstore': 'AppStore',
  // 'Amazon': '',
  'Interest-Based Ads': 'Ads',
  'Apple Support Communities': 'SupportCommunities',
  'Game Center': 'GameCenter',
  'iChat Account': 'IChat',
  'iCloud': 'ICloud',
  'iTunes': 'ITunes',
  // 'Internet': 'Internet',
  'Wireless': 'Wireless',
  'Group Video Calling': 'GroupVideoCalling',
  '(Mobile)': 'Mobile',
  '(Premium)': 'Premium',
  '(Unlimited)': 'Unlimited',
  'Amazon Coins': 'Coins',
  'Amazon Device': 'Device',
  'Amazon Drive and Prime Photos': 'DriveAndPrimePhotos',
  'Amazon FreeTime Unlimited Terms & Conditions and Kindle FreeTime Unlimited': 'FreeTimeUnlimited',
  'Amazon GameCircle': 'GameCircle',
  'Amazon Kindle Store': 'KindleStore',
  'Amazon Maps': 'Maps',
  'Amazon Music': 'Music',
  'Amazon Prime': 'Prime',
  'Amazon Silk': 'Silk',
  'Amazon.com': '',
  'Kindle Cloud Reader': 'KindleCloudReader',
  'Kindle E-Reader and Fire Tablet': 'KindleTable',
  'Kindle Personal Documents Distributor': 'KindleDistributor',
  'Kindle Special Offer Text Notifications': 'KindleNotifications',
  'Kindle Store': 'KindleStore',
  'Kindle Unlimited': 'KindleUnlimited',
  'Kindle for Android': 'KindleAndroid',
  'Kindle for Mac': 'KindleMac',
  'Kindle for PC': 'KindlePC',
  'Kindle for Windows 8': 'KindleWindows',
  'Limited-Time Special Offers Promotional Discount': 'Offers',
  'Residential Subscriber': 'ResidentialSubscription',
  'Monthly Payments': 'MonthlyPayments',
  'Web Services': 'WebServices',
  'for Xfinity Internet': ''
};

function domainNameToService(domainName) {
  return toPascalCase(domainName.split('.')[0]);
}

const typeNotFound = {};
function getSnapshotPathComponents(domainName, fileName) {
  let type;
  let subServiceFound = '';
  let typeString = fileName.replace(/.txt$/, '');
  Object.keys(subServices).forEach(subService => {
    if (typeString.startsWith(subService)) {
      // console.log('Starts with!', [subService, typeString]);
      subServiceFound = subServices[subService];
      typeString = typeString.substring(subService.length + 1);
      // console.log('substringing start', [ subServiceFound, typeString ]);
    } else if (typeString.endsWith(subService)) {
      // console.log('Starts with!');
      subServiceFound = subServices[subService];
      typeString = typeString.substring(0, typeString.length - subService.length - 1);
      // console.log('substringing end', [ subService, typeString ]);
    }
  })
  try {
    type = toType(typeString);
  } catch (e) {
    // console.log(e.message);
    type = 'unknown';
    typeNotFound[`[${domainName}] ${fileName.replace(/.txt$/, '')}`] = true;
  }
  function finalTouch(serviceName) {
    const touchups = {
      '123greetings': '123 Greetings',
      'Aa': 'Alcoholics Anonymous',
      'Aarp': 'AARP',
      'Abcnews': 'ABC News',
      'Abercrombie': 'Abercrombie & Fitch',
      'About': 'About.com',
      'Accuweather': 'AccuWeather',
      'Acdelco': 'ACDelco',
      'Adage': 'Ad Age',
      'Addthis': 'AddThis',
      'Adn': 'Anchorage Daily News',
      'Af-medical': 'AF Medical',
      'Allthingsd': 'AllThingsD',
      'Americanmedical-id': 'American Medical ID',
      'AmazonAlexa': 'Alexa',
      'Bl': 'The British Library',
      'AppleITunes': 'Apple iTunes',
      'Ask': 'ASKfm',
      'Asmallworld': 'ASMALLWORLD',
      'Deviantart': 'DeviantArt',
      'Last': 'Last.fm',
      'Livejournal': 'LiveJournal',
      'Stackexchange': 'Stack Exchange',
      'Whatsapp': 'WhatsApp'
    };
    return touchups[serviceName] || serviceName;
  }
  return {
    serviceName: `${finalTouch(domainNameToService(domainName))}${subServiceFound}`,
    type
  }
}

function translateSnapshotPath(domainName, fileName) {
  const { serviceName, type } = getSnapshotPathComponents(domainName, fileName)
  return path.join(SNAPSHOTS_PATH, `${serviceName}/${type}.html`);
}

function translateVersionPath(domainName, fileName) {
  const { serviceName, type } = getSnapshotPathComponents(domainName, fileName)
  if ((type === 'unknown')  && (!process.env.ALLOW_UNKNOWN)) {
    return null;
  }
  return path.join(VERSIONS_PATH, `${serviceName}/${type}.md`);
}

function getLocalRulesFolder() {
  return path.join(LOCAL_TOSBACK2_REPO, TOSBACK2_RULES_FOLDER_NAME);
}

function getLocalCrawlsFolders() {
  return [
    TOSBACK2_CRAWLS_FOLDER_NAME_1,
    TOSBACK2_CRAWLS_FOLDER_NAME_2
  ];
}

function getGitHubWebUrl(commitHash, filename) {
  return [
    TOSBACK2_WEB_ROOT,
    'blob',
    commitHash,
    TOSBACK2_RULES_FOLDER_NAME,
    filename
  ].join('/');
}

async function parseFile(filename) {
  const data = await fs.readFile(filename);
  return parser.toJson(data);
}

function toPascalCase(str) {
  const lowerCase = str.toLowerCase();
  return str[0].toUpperCase() + lowerCase.substring(1);
}

function toType(str) {
  let found;
  for (const i in TYPES) {
    if ((i === str) || (i === typesMap[str])) {
      found = i;
      break;
    }
  }
  if (!found) {
    throw new Error(`Unsupported type: ${str}`);
  }
  return found;
}

const queue = new PQueue({ concurrency: THREADS });

async function processWhenReady(serviceName, docName, url, xpath, importedFrom, filePathIn) {
  // console.log(serviceName, docName, 'queued');
  return queue.add(() => processNow(serviceName, docName, url, xpath, importedFrom, filePathIn));
}

const pending = {};
async function processNow(serviceName, docName, url, xpath, importedFrom, filePathIn) {
  // console.log(filePathIn, serviceName, docName, 'processing');
  // console.log(filePathIn);
  // return;
  if (urlAlreadyCovered[url]) {
    console.log(filePathIn, serviceName, docName, 'Already covered');
    return;
  }
  pending[`${serviceName} - ${docName} - ${url}`] = true;
  const fileNameOut = `${serviceName}.json`;
  if (!services[fileNameOut]) {
    services[fileNameOut] = {
      name: serviceName,
      importedFrom,
      documents: {}
    };
  }
  if (!servicesInvalid[fileNameOut]) {
    servicesInvalid[fileNameOut] = {
      name: serviceName,
      importedFrom,
      documents: {}
    };
  }
  if (!servicesUnknownType[fileNameOut]) {
    servicesUnknownType[fileNameOut] = {
      name: serviceName,
      importedFrom,
      documents: {}
    };
  }
  let unknownType = false;
  try {
    const type = toType(docName);
    if (type === 'unknown') { // this will only happen if process.env.ALLOW_UNKNOWN is true
      console.log('Unknown type!');
      unknownType = true;
    }
    if (services[fileNameOut].documents[type]) {
      console.log('Same type used twice!');
      unknownType = true;
    }
    let select = 'body';
    if (xpath) {
      try {
        select = xPathToCss(xpath) || 'body';
      } catch(e) {
        // use 'body' as the selector
      }
    }
    const docObj = {
      fetch: url,
      select
    };
    const validationResult = await validateDocument(docObj, []);
    if (validationResult.ok) {
      if (unknownType) {
        console.log('saved-doc=unknown', fileNameOut, type);
        servicesUnknownType[fileNameOut].documents[type] = docObj;
      } else {
        console.log('saved-doc=normal', fileNameOut, type);
        services[fileNameOut].documents[type] = docObj;
      }
      console.log(filePathIn, serviceName, docName, 'done');  
    } else if (!validationResult.fetchable) {
      console.log(filePathIn, 'not fetchable', url);
      console.log('saved-doc=invalid', fileNameOut, type);
      servicesInvalid[fileNameOut].documents[type] = docObj;
    } else if (!validationResult.selectorMatchesAnElement) {
      console.log(filePathIn, 'selector not found', url, select);
      console.log('saved-doc=invalid', fileNameOut, type);
      servicesInvalid[fileNameOut].documents[type] = docObj;
    } else if (!validationResult.hasConsistentFilteredContent) {
      console.log(filePathIn, 'inconsistent');
      console.log('saved-doc=invalid', fileNameOut, type);
      servicesInvalid[fileNameOut].documents[type] = docObj;
    } else if (!validationResult.isLongEnough) {
      console.log(filePathIn, 'too short');
      console.log('saved-doc=invalid', fileNameOut, type);
      servicesInvalid[fileNameOut].documents[type] = docObj;
    } else {
      console.log(filePathIn, 'invalid for unrecognized reason');
      console.log('saved-doc=invalid', fileNameOut, type);
      servicesInvalid[fileNameOut].documents[type] = docObj;
    }
  } catch (e) {
    // console.log(e);
    console.log(filePathIn, serviceName, docName, 'fail', e.message);
    console.log('saved-doc=invalid', fileNameOut, type);
    servicesInvalid[fileNameOut].documents[type] = docObj;
  }
  await trySave(fileNameOut);

  delete pending[`${serviceName} - ${docName} - ${url}`];
  // console.log('Pending:', Object.keys(pending));
}

async function processTosback2(importedFrom, imported) {
  if (!imported.sitename) {
    // console.log('no imported.sitename, skipping', importedFrom, imported);
    return;
  }
  if (!Array.isArray(imported.sitename.docname)) {
    imported.sitename.docname = [ imported.sitename.docname ];
  }
  const serviceName = domainNameToService(imported.sitename.name);
  const promises = imported.sitename.docname.map(async docnameObj => {
    if (!docnameObj) {
      return;
    }
    // console.log(serviceName, imported, docnameObj);
    // processWhenReady(serviceName, docName, url, xpath, importedFrom, filePathIn)
    return processWhenReady(
	    serviceName,
	    docnameObj.name,
	    docnameObj.url.name,
	    docnameObj.url.xpath,
	    importedFrom
    ).catch(e => {
      console.log('Could not process', serviceName, docnameObj.name, docnameObj.url.name, docnameObj.url.xpath, importedFrom, e.message);
    });
  });
  return Promise.all(promises);
}

function getTosbackGit() {
  return simpleGit({
    baseDir: LOCAL_TOSBACK2_REPO,
    binary: 'git',
    maxConcurrentProcesses: 6,
  });
}
function getSnapshotGit() {
  return simpleGit({
    baseDir: SNAPSHOTS_PATH,
    binary: 'git',
    maxConcurrentProcesses: 6,
  });
}
function getVersionGit() {
  return simpleGit({
    baseDir: VERSIONS_PATH,
    binary: 'git',
    maxConcurrentProcesses: 6,
  });
}

async function parseAllGitXml(folder, only) {
  const git = getTosbackGit();
  const gitLog = await git.log();
  const commitHash = gitLog.latest.hash;

  const files = await fs.readdir(folder);
  const promises = files.map(async filename => {
    if (only && filename !== `${only}.xml`) {
      // console.log(`Skipping ${filename}, only looking for ${only}.xml.`);
      return;
    }
    let imported;
    try {
      imported = JSON.parse(await parseFile(path.join(folder, filename)));
    } catch (e) {
      // console.error('Error parsing xml', filename, e.message);
      return;
    }
    await processTosback2(getGitHubWebUrl(commitHash, filename), imported);
  });
  await Promise.all(promises);
}

async function parseAllPg(connectionString) {
  const client = new Client({
    connectionString
  });
  await client.connect();
  const res = await client.query('SELECT d.name, d.xpath, d.url, s.url as domains, s.name as service from documents d inner join services s on d.service_id=s.id');
  await Promise.all(res.rows.map(row => processWhenReady(row.service, row.name, row.url, row.xpath)));
  await client.end();
}

const couldNotRead = {};
const fileSemaphore = new PQueue({ concurrency: 1 });
const commitSemaphore = new PQueue({ concurrency: 1 });

function createRule(serviceName, type, docnameObj, importedFrom, filePathIn) {
  return processWhenReady(serviceName, type, docnameObj.url.name, docnameObj.url.xpath, importedFrom, filePathIn);
}

async function importRule(domainName, fileName, tosback2Hash, filePathIn) {
  // console.log(domainName, fileName, tosback2Hash);
  let imported;
  try {
    imported = JSON.parse(await parseFile(path.join(getLocalRulesFolder(), `${domainName}.xml`)));
  } catch (e) {
    console.error('Error parsing xml', filename, e.message);
    throw e;
  }
  if (!Array.isArray(imported.sitename.docname)) {
    imported.sitename.docname = [ imported.sitename.docname ];
  }
  // const serviceName = domainNameToService(imported.sitename.name);
  const docName = fileName.replace(/.txt$/g, '');
  let found = 0;
  const promises = imported.sitename.docname.map(async docnameObj => {
    // console.log('looking for', docName, docnameObj);
    if (docnameObj.name === docName && !found) {
      // console.log('yes!');
      found++;
      const { serviceName, type } = getSnapshotPathComponents(domainName, fileName)
      await createRule(serviceName, type, docnameObj, encodeURI(`https://github.com/tosdr/tosback2/blob/${tosback2Hash}/rules/${domainName}.xml`), filePathIn);
    }
  });
  // throw new Error('debug!');
  // FIXME: only one of these promises actually does something
  await Promise.all(promises);
  if (found !== 1) {
    console.log(filePathIn, `Found ${found} docname objects with name "${docName}" in ${path.join(getLocalRulesFolder(), `${domainName}.xml`)}`);
    // imported.sitename.docname.map(async docnameObj => {
    //   console.log(filePathIn, `Found "${docnameObj.name}"`);
    // });
  }
}
async function importCrawl(fileName, foldersToTry, domainName, filePathIn) {
  let thisFileCommits;
  await fileSemaphore.add(async () => {
    const snapshotDestPath = translateSnapshotPath(domainName, fileName);
    const versionDestPath = translateVersionPath(domainName, fileName);
    let exists;
    try {
      await fs.stat(snapshotDestPath);
      exists = true;
    } catch (e) {
      exists = false;
    }
    // console.log('importCrawl', domainName, fileName, translateSnapshotPath(domainName, fileName), );
    const tosbackGit = getTosbackGit();
    const snapshotGit = getSnapshotGit();
    const versionGit = getVersionGit();

    const filePath1 = path.join(foldersToTry[0], domainName, fileName);
    let filePath2;
    if (foldersToTry.length > 1) {
      filePath2 = path.join(foldersToTry[1], domainName, fileName);
    }
    // console.log('filePath', filePath1);
    // console.log('Tosback2 git checkout BRANCH_TO_USE');
    await tosbackGit.checkout(BRANCH_TO_USE);
    // console.log('Tosback2 git pull');
    await tosbackGit.pull();
    const tosback2GitLog = await tosbackGit.log();
    const tosback2Hash = tosback2GitLog.latest.hash;
    if (versionDestPath) {
      try {
        await importRule(domainName, fileName, tosback2Hash, filePathIn);
      } catch (e) {
        // console.error('Imported snapshots but could not import rule', domainName, fileName);
      }
    } else {
      console.log(filePathIn, 'not importing rule since versionDestPath is null (doc-type unknown, probably?)');
    }
    // This will set the --follow flag, see:
    // https://github.com/steveukx/git-js/blob/80741ac/src/git.js#L891
    const gitLog = await tosbackGit.log({ file: filePath1 });
    thisFileCommits = gitLog.all.reverse();
    // console.log('inbetween', domainName, fileName);
    const commitsQueue = new PQueue({ concurrency: 1 });
    let starting = true;
    const commitPromises = thisFileCommits.map(commit => commitsQueue.add(async() => {
      // console.log('handling commit', fileName, commit, starting);
      // console.log('tosback git checkout', commit.hash);
      await tosbackGit.checkout(commit.hash);
      // console.log('Reading file', path.join(LOCAL_TOSBACK2_REPO, filePath1), commit.hash);
      let fileTxtAtCommit;
      let sourceUrl;
      try {
        fileTxtAtCommit = await fs.readFile(path.join(LOCAL_TOSBACK2_REPO, filePath1));
        sourceUrl = `https://github.com/tosdr/tosback2/blob/${commit.hash}/${filePath1}`;
      } catch (e) {
        if (filePath2) {
          // console.log('Retrying to load file at', filePath2, commit.hash);
          try {
            fileTxtAtCommit = await fs.readFile(path.join(LOCAL_TOSBACK2_REPO, filePath2));
            sourceUrl = `https://github.com/tosdr/tosback2/blob/${commit.hash}/${filePath2}`;
          } catch (e) {
            if (!couldNotRead[commit.hash]) {
              couldNotRead[commit.hash] = [];
            }
            couldNotRead[commit.hash].push(filePath1);
            // console.log('Could not load, skipping', couldNotRead);
          }
        } else {
          if (!couldNotRead[commit.hash]) {
            couldNotRead[commit.hash] = [];
          }
          couldNotRead[commit.hash].push(filePath1);
        }
      }
      if (!fileTxtAtCommit) {
        console.log(filePathIn, `no file text at tosback2-commit ${commit.hash}`);
        return;
      }

      const html = HTML_PREFIX + fileTxtAtCommit + HTML_SUFFIX;
      // console.log('saving snapshot', snapshotDestPath);
      const containingDirSnapshot = path.dirname(snapshotDestPath);
      await fs.mkdir(containingDirSnapshot, { recursive: true });
      await fs.writeFile(snapshotDestPath, html);
      // console.log('committing', snapshotDestPath, `From tosback2 ${commit.hash}`);
      await snapshotGit.add('.');
      const verb = (starting ? 'Start tracking' : 'Update');
      const { serviceName, type } = getSnapshotPathComponents(domainName, fileName);
      starting = false;
      const dateString = new Date(commit.date).toISOString().split('T')[0];
      const snapshotCommitMessage = [
        `${verb} ${serviceName} ${type}`,
        '',
        `Imported from ${encodeURI(sourceUrl)}`,
        `Snapshot originally obtained on ${dateString}`
      ].join('\n');
      // console.log('committing snapshot');
      await snapshotGit.commit(snapshotCommitMessage, [ '-a', `--date="${commit.date}"` ]);
      const gitLog = await snapshotGit.log();
      const snapshotCommitHash = gitLog.latest.hash;

      if (!versionDestPath) {
        console.log(filePathIn, `recording snapshot but not version (doc-type unknown, probably?)`);
        return;
      }

      // console.log({ snapshotCommitHash });
      const filteredContent = await filter({ content: html, mimeType: 'text/html', documentDeclaration: { fetch: 'http://ignore.me/', select: 'body' }, filterFunctions: [] }).catch((e) => {
        // console.log(e);
        throw new Error(`Could not filter ${snapshotDestPath} ${e.message}`);
      });
      if (!filteredContent) {
        console.log(filePathIn, `no filtered content from tosback2-commit ${commit.hash}`);
        return;
      }
      // console.log('saving version', versionDestPath);
      const containingDirVersion = path.dirname(versionDestPath);
      await fs.mkdir(containingDirVersion, { recursive: true });
      await fs.writeFile(versionDestPath, filteredContent);
      // console.log('committing', versionDestPath, `From tosback2 ${commit.hash}`);
      await versionGit.add('.');
      const versionCommitMessage = [
        `${verb} ${serviceName} ${type}`,
        '',
        `This version was recorded after filtering snapshot ${snapshotCommitHash}`,
        `Snapshot originally obtained on ${dateString}`
      ].join('\n');
      await versionGit.commit(versionCommitMessage, [ '-a', `--date="${commit.date}"` ]);
    }));
    await Promise.all(commitPromises);
    // console.log('importCrawl end', domainName, fileName);
  });
}

function filePathToDomainName(filePath) {
  const parts = filePath.split('/');
  let ret = parts[1];
  if (!ret) {
    console.log('huh?', filePath);
  }
  const exceptions = {
    'help.twcable.com': 'twcable_Residential_Services_Subscriber_Agreement',
    'www.craigslist.org': 'craigslist_Terms_Of_Use'
  };
  if (exceptions[ret]) {
    return exceptions[ret];
  }
  return ret;
}
function filePathToFileName(filePath) {
  const parts = filePath.split('/');
  return parts[parts.length-1];
}
function filePathToFoldersToTry(filePath) {
  const parts = filePath.split('/');
  return [ parts[0] ];
}

async function importCrawls(foldersToTry, only, rulesOnly) {
  // Reasoning here is that if you only want the rules then you're not interested
  // in documents that can no longer be crawled, because those rules will fail to import anyway.
  // So using the shorter list in that case (590 instead of 1711).
  let filePaths = (await fs.readFile(
    (rulesOnly ? './crawl-files-list-current.txt' : './crawl-files-list.txt')
  )).toString().split('\n').filter(x => x.length);
  if (only) {
    console.log('Filtering filenames for importCrawls, looking for', only);
    filePaths = filePaths.filter(x => (x.indexOf(only) !== -1));
  }
  filePaths = filePaths.filter(x => {
    if (x.startsWith('crawl_reviewed/')) {
      return true;
    }
    const equivalent = x.replace('crawl/', 'crawl_reviewed/');
    if (filePaths.indexOf(equivalent) !== -1) {
      // console.log(x, 'equivalent to', equivalent);
      return false;
    }
    return true;
  });

  if (rulesOnly) {
    const tosbackGit = getTosbackGit();
    await tosbackGit.checkout(BRANCH_TO_USE);
    await tosbackGit.pull();
    const tosback2GitLog = await tosbackGit.log();
    const tosback2Hash = tosback2GitLog.latest.hash;
    const filePromises = filePaths.map(filePath => {
      return importRule(filePathToDomainName(filePath), filePathToFileName(filePath), tosback2Hash, filePath)
        .catch(e => console.log(filePath, 'bomb', e.message));
    });
    return Promise.all(filePromises);
  }

  const filePromises = filePaths.map(filePath => {
    return importCrawl(filePathToFileName(filePath), filePathToFoldersToTry(filePath), filePathToDomainName(filePath), filePath)
      .catch(e => console.log(filePath, 'bomb', e.message));
  });
  return Promise.all(filePromises);
}

async function trySave(i) {
  console.log('Saving', i, Object.keys(servicesInvalid[i].documents).length, Object.keys(servicesUnknownType[i].documents).length, Object.keys(services[i].documents).length);
  if (Object.keys(servicesInvalid[i].documents).length) {
    try {
      assertValid(serviceSchema, servicesInvalid[i]);
      const fileName = path.join(SERVICES_INVALID_PATH, i);
      const containingDirRule = path.dirname(fileName);
      await fs.mkdir(containingDirRule, { recursive: true });
      await fs.writeFile(fileName, `${JSON.stringify(servicesInvalid[i], null, 2)}\n`);
      // await new Promise(resolve => setTimeout(resolve, 100));
      console.log('Saved', path.join(SERVICES_INVALID_PATH, i));
    } catch (e) {
      console.error('Could not save', e);
    }
  }

  if (Object.keys(servicesUnknownType[i].documents).length) {
    try {
      assertValid(serviceSchema, servicesUnknownType[i]);
      const fileName = path.join(SERVICES_UNKNOWN_TYPE_PATH, i);
      const containingDirRule = path.dirname(fileName);
      await fs.mkdir(containingDirRule, { recursive: true });
      await fs.writeFile(fileName, `${JSON.stringify(servicesUnknownType[i], null, 2)}\n`);
      // await new Promise(resolve => setTimeout(resolve, 100));
      console.log('Saved', path.join(SERVICES_UNKNOWN_TYPE_PATH, i));
    } catch (e) {
      console.error('Could not save', e);
    }
  }

  if (Object.keys(services[i].documents).length) {
    try {
      assertValid(serviceSchema, services[i]);
      const fileName = path.join(SERVICES_PATH, i);
      const containingDirRule = path.dirname(fileName);
      await fs.mkdir(containingDirRule, { recursive: true });
      await fs.writeFile(fileName, `${JSON.stringify(services[i], null, 2)}\n`);
      // await new Promise(resolve => setTimeout(resolve, 100));
      console.log('Saved', path.join(SERVICES_PATH, i));
    } catch (e) {
      console.error('Could not save', e);
    }
  }
}

async function readExistingServices() {
  const serviceFiles = await fs.readdir(SERVICES_PATH);
  await Promise.all(serviceFiles.filter(x => x.endsWith('.json')).map(async serviceFile => {
    const content = JSON.parse(await fs.readFile(path.join(SERVICES_PATH, serviceFile)));
    services[serviceFile] = content;
    Object.keys(content.documents).forEach(x => {
      const url = content.documents[x].fetch;
      if (!urlAlreadyCovered[url]) {
        urlAlreadyCovered[url] = [];
      }
      urlAlreadyCovered[url].push({
        service: content.name,
        docType: x,
        select: content.documents[x].select
      });
    });
  }));
  return urlAlreadyCovered;
}

async function run(includeXml, includePsql, includeCrawls, only, rulesOnly) {
  await readExistingServices();

  if (includeXml) {
    await parseAllGitXml(getLocalRulesFolder(), only);
  }
  if (includePsql) {
    await parseAllPg(POSTGRES_URL, services);
  }
  if (includeCrawls) {
    await importCrawls(getLocalCrawlsFolders(), only, rulesOnly);
  }
  await fileSemaphore.add(async () => {
    // console.log('Setting Tosback2 repo back to BRANCH_TO_USE');
    const tosbackGit = getTosbackGit();
    await tosbackGit.checkout(BRANCH_TO_USE);
  });
  // console.log(Object.keys(typeNotFound));
}

// Edit this line to run the Tosback rules / ToS;DR rules / Tosback crawls import(s) you want:
run(false, false, true, process.env.ONLY, process.env.RULES_ONLY);

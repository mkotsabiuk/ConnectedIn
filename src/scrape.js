const SUGGESTION_GROUP_SELECTOR = '.mn-cohort-view.mn-cohort-view__grid-wrapper.ember-view';
const PEOPLE_CARD_SELECTOR = '.discover-entity-card.discover-entity-card--calc-width.ember-view';
const GROUP_NAME_SELECTOR = '.mn-cohort-view__grid-heading h2';
const PERSON_NAME_SELECTOR = '.discover-person-card__name';
const CONNECT_BUTTON_SELECTOR = "button[data-control-name='people_connect']";

const puppeteer = require('puppeteer');

const options = {
    launch: { headless: false },
    setViewport: { width: 1940, height: 1080 },
    timeout: 120000,
    setCookie: {
        name: "li_at",
        domain: "www.linkedin.com"
    }
};

const scrape = async (options) => {
    options.setCookie.value = options.cookie || options.setCookie.value;
    console.log('Scraping started with options: %j', options);

    const browser = await puppeteer.launch(options.launch)
        .then(browser => {
            console.log('Browser created');
            return browser;
        });

    const page = await browser.newPage()
        .then(page => {
            console.log('Page in browser created');
            return page;
        });

    if (!options.launch.headless) {
        await page.setViewport(options.setViewport)
            .then(() => {
                console.log('Viewport parameters added');
            });
    }
    page.setDefaultTimeout(options.timeout)
    console.log(`Default timeout value ${options.timeout} added`);

    await page.setCookie(options.setCookie)
        .then(() => {
            console.log('Cookie added');
        });

    await Promise.all([
        page.goto(options.uri, { waitUntil: ['networkidle2'] })
            .then(() => {
                console.log(`Got ${options.uri} page`);
            }),
        page.waitForSelector(SUGGESTION_GROUP_SELECTOR)
            .then(() => {
                console.log(`Got '${SUGGESTION_GROUP_SELECTOR}' selector`);
            }),
    ]);

    await page.$$(SUGGESTION_GROUP_SELECTOR)
        .then(async suggestions => {
            if (!suggestions) {
                console.log(`No suggestions`)
                return;
            }

            console.log(`Got ${suggestions.length || 0} suggestions`)
            let groups = new Map();

            for (let group of suggestions) {
                const groupName = await group.$eval(GROUP_NAME_SELECTOR, el => el.innerText);
                if (/follow|subscribe/i.test(groupName)) {
                    continue;
                }

                const groupPeople = await group.$$(PEOPLE_CARD_SELECTOR, el => el.innerText);
                console.log(`Group '${groupName}' has ${groupPeople.length || 0} people`);

                groups.set(groupName, groupPeople);
            }
            return groups;
        })
        .then(async groups => {
            console.log('\nGroups handling started\n');
            let count = 1;
            for (let [name, people] of groups) {
                console.log(`Group '${name}' with ${people.length || 0} people handling:`);

                for (let person of people) {
                    let isCompany = false;
                    const personName = await person.$eval(PERSON_NAME_SELECTOR, el => el.innerText)
                        .catch(error => {
                            console.error(error.message);
                            isCompany = true;
                        });

                    if (isCompany) {
                        break;
                    }

                    const personConnectButton = await person.$(CONNECT_BUTTON_SELECTOR)
                        .catch(error => {
                            console.error(error.message);

                        });

                    let clickDelay = Math.floor(Math.random() * 50);
                    await personConnectButton.click({ delay: clickDelay })
                        .catch(error => {
                            console.error(error.message);
                        });

                    const isModal = await page.$eval('#artdeco-modal-outlet div', modal => false)
                        .catch(error => {
                            console.error(error.message);
                            return true;
                        });

                    console.log(`Modal window appeared -> ${isModal}`);
                    
                    await new Promise((r) => setTimeout(r, 1200));
                    
                    if (isModal) {
                        throw new Error('Can not add any more people to network');
                    }


                    console.log(`${count} ${personName} added to network`);
                    count++;
                }
            }
        })
        .catch(error => {
            console.error(error.message);
        });

    await browser.close()
        .then(() => {
            console.log('Browser closed and script finished');
        });
};

export default (params) => scrape({ ...options, ...params });
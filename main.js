const config = require('./config');
const path = require('path');
const chalk = require('chalk');
const fs = require('fs');
const ProgressBar = require('progress');
const getListOfJSONPathsFromFolder = require('./helpers/getListOfJSONPathsFromFolder');

let TRACKER_RADAR_DOMAINS_PATH = path.join(config.trackerRadarRepoPath, '/domains/');
const TRACKER_RADAR_ENTITIES_PATH = path.join(config.trackerRadarRepoPath, '/entities/');
const REGION = 'US';

// Backwards compatibility for regions updates
if (fs.existsSync(path.join(TRACKER_RADAR_DOMAINS_PATH, REGION))) {
    TRACKER_RADAR_DOMAINS_PATH = path.join(TRACKER_RADAR_DOMAINS_PATH, REGION);
}

const domainFiles = getListOfJSONPathsFromFolder(TRACKER_RADAR_DOMAINS_PATH);
const entityFiles = getListOfJSONPathsFromFolder(TRACKER_RADAR_ENTITIES_PATH);

const progressBar = new ProgressBar('[:bar] :percent ETA :etas :file', {
    complete: chalk.green('='),
    incomplete: ' ',
    total: domainFiles.length + entityFiles.length,
    width: 30
});

const stats = {
    failingFiles: 0
};

const nodesMap = new Map();
const output = {
    nodes: [],
    links: []
};

domainFiles.forEach(({file, resolvedPath}) => {
    progressBar.tick({file});

    let data = null;

    try {
        const dataString = fs.readFileSync(resolvedPath, 'utf8');
        data = JSON.parse(dataString);
    } catch (e) {
        stats.failingFiles++;
        return;
    }

    // skip small domains
    if (data.prevalence < 0.005) {
        return;
    }

    if (!nodesMap.has(data.domain)) {
        let group = 'other';

        if (data.owner && ['Google', 'Microsoft', 'Facebook', 'Amazon.com', 'Adobe'].includes(data.owner.displayName)) {
            group = data.owner.displayName;
        }

        nodesMap.set(data.domain, {id: data.domain, label: `${data.domain} (${data.owner.displayName})`, group, val: data.prevalence * 10});
    }

    if (data.topInitiators && data.topInitiators.length) {
        const topTarget = Object.values(data.topInitiators)[0].domain;

        if (topTarget !== 'first party') {
            output.links.push({
                source: data.domain,
                target: topTarget,
                value: 1
            });
        }
    }
});

// remove dead links
output.links = output.links.filter(item => nodesMap.has(item.source) && nodesMap.has(item.target));

output.nodes = Array.from(nodesMap.values());

fs.writeFileSync(path.join('./docs/', 'output.json'), JSON.stringify(output, null, 2));

console.log(stats);
window.addEventListener('load', (event) => {
    document.getElementById('generateButton').addEventListener('click', generateTables);

    // Set the default previous status time to noon on the day two weeks ago
    let target = new Date();
    target.setHours(target.getHours() - (24 * 7 * 2));
    document.getElementById('previousStatusTimeField').value = `${target.getFullYear()}-${target.getMonth()+1}-${target.getDate()} 12:00`;
});

function generateTables() {
    fetchGraphQLProjectData()
    .then((project) => {
        clearTables();

        for (let column of project.columns.nodes) {
            let table = addTable(column.name);
            for (let card of column.cards.nodes) {
                let issue = card.content;

                if (issue === null) {
                    addRow(table, '', card.note, '', '', '', '');
                } else {
                    let issueId = issue.repository.name + ' #' + issue.number;
                    if (issueId === ' #') {
                        issueId = '';
                    }

                    let issueTitle = issue.title;

                    let size = getSize(issue);

                    let assigneeName = '';
                    if (issue.assignees.nodes.length > 0) {
                        let assignee = issue.assignees.nodes[0];
                        assigneeName = assignee.name || assignee.login;
                    }

                    let targetTime = new Date(document.getElementById('previousStatusTimeField').value);
                    let previousColumn = getPreviousColumn(issue, targetTime);

                    addRow(table, issueId, issueTitle, size, assigneeName, previousColumn);
                }

            }
        }
    });
}

function getTableArea() {
    return document.getElementById('tables');
}

function clearTables() {
    let area = getTableArea();
    while (area.firstChild) {
        area.removeChild(area.firstChild);
    }
}

function addTable(title) {
    let area = getTableArea();
    let heading = document.createElement('h2');
    heading.textContent = title;
    area.appendChild(heading);
    let table = document.createElement('table');
    table.setAttribute('data-title', title);

    let row = document.createElement('tr');
    for (let heading of ['Issue ID', 'Title', 'Size', 'Assignee', 'Previous status']) {
        let cell = document.createElement('th');
        cell.textContent = heading;
        row.appendChild(cell);
    }
    table.appendChild(row);

    area.appendChild(table);
    return table;
}

function addRow(table, issueId, issueTitle, size, assignee, previousColumn) {
    let row = document.createElement('tr');
    addCell(row, issueId);
    addCell(row, issueTitle);
    addCell(row, size);
    addCell(row, assignee);
    addCell(row, previousColumn);
    table.appendChild(row);
}

function addCell(row, text) {
    let cell = document.createElement('td');
    cell.textContent = text;
    row.appendChild(cell);
}

// Despite https://help.github.com/en/github/managing-your-work-on-github/transferring-an-issue-to-another-repository
// Migrating an issue between repos seemingly does cause it to lose its project history, though project membership isn't lost
function getPreviousColumn(issue, targetTime) {
    if (issue.timelineItems == null) {
        return '** New Issue **';
    }
    let events = issue.timelineItems.nodes

    let latestChange = new Date(0);
    let latestColumn = '** New Issue **';

    for (let event of events) {
        let changeTime = new Date(event.createdAt);
        if (changeTime > latestChange && changeTime < targetTime) {
            latestChange = changeTime;
            latestColumn = event.projectColumnName;
        }
    }
    return latestColumn;
}

function getSize(issue) {
    if (issue.labels == null) {
        return '';
    }

    let sizeLabel = issue.labels.nodes.find(label => label.name.startsWith('size:'));
    if (typeof sizeLabel === 'undefined') {
        return '';
    }
    return sizeLabel.name.split(':')[1].trim();
}

function getApiKey() {
    return document.getElementById('apiKeyField').value;
}

function getOrganisationName() {
    return document.getElementById('organisationField').value;
}

function getProjectName() {
    return document.getElementById('projectField').value;
}

function fetchGraphQLProjectData() {
    let query =
`query ($organisation_name: String!, $project_name: String) {
    organization(login: $organisation_name) {
        name
        projects (first: 1 search: $project_name) {
            nodes {
                name
                columns(first: 20) {
                    nodes {
                        name
                        cards(archivedStates: [NOT_ARCHIVED]){
                            totalCount
                            nodes {
                                content {
                                    ... on Issue {
                                        title
                                        assignees(first: 1) {
                                            nodes {
                                                login
                                                name
                                            }
                                        }
                                        repository {
                                            name
                                        }
                                        timelineItems(last: 200, itemTypes: [ADDED_TO_PROJECT_EVENT, MOVED_COLUMNS_IN_PROJECT_EVENT]) {
                                            nodes {
                                                ... on AddedToProjectEvent {
                                                    projectColumnName
                                                    createdAt
                                                }
                                                ... on MovedColumnsInProjectEvent {
                                                    projectColumnName
                                                    createdAt
                                                }
                                            }
                                        }
                                        number
                                        labels(first: 20) {
                                            nodes {
                                                name
                                            }
                                        }
                                    }
                                    ... on PullRequest {
                                        title
                                        assignees(first: 1) {
                                            nodes {
                                                login
                                                name
                                            }
                                        }
                                        repository {
                                            name
                                        }
                                        number
                                    }
                                }
                                note
                            }
                        }
                    }
                }
            }
        }
    }
}`;

    return fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.github.starfox-preview+json',
            'Authorization' : 'bearer ' + getApiKey(),
        },
        body: JSON.stringify({
            query,
            variables: {
                organisation_name: getOrganisationName(),
                project_name: getProjectName(),
            },
        })
    })
    .then(response => response.json())
    .then(json => json.data.organization.projects.nodes[0]);
}
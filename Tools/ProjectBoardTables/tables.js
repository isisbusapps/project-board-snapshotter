window.addEventListener('load', (event) => {
    document.getElementById('generateButton').addEventListener('click', generateTables);

    // Set the default previous status time to noon on the day two weeks ago
    const target = new Date();
    target.setHours(target.getHours() - (24 * 7 * 2));
    setPreviousColumnTargetDate(target.getFullYear(), target.getMonth()+1, target.getDate(), 12, '00');
});

function generateTables() {
    fetchGraphQLProjectData()
    .then((project) => {
        clearTables();

        for (let column of project.columns.nodes) {
            const table = addTable(`${column.name} (${column.cards.totalCount})`);
            for (let card of column.cards.nodes) {
                const issue = card.content;

                if (issue === null) {
                    addRow(table, '', card.note, '', '', '', '');
                } else {
                    const issueId = issue.repository.name + ' #' + issue.number;
                    const issueTitle = issue.title;
                    const size = getSize(issue);
                    const assigneeNames = getAssigneeNames(issue);
                    const previousColumn = getPreviousColumn(issue);

                    addRow(table, issueId, issueTitle, size, assigneeNames, previousColumn);
                }

            }
        }
    });
}

function getTableArea() {
    return document.getElementById('tables');
}

function clearTables() {
    const area = getTableArea();
    while (area.firstChild) {
        area.removeChild(area.firstChild);
    }
}

function addTable(title) {
    const area = getTableArea();
    const heading = document.createElement('h2');
    heading.textContent = title;
    area.appendChild(heading);
    const table = document.createElement('table');
    table.setAttribute('data-title', title);

    const row = document.createElement('tr');
    for (let heading of ['Issue ID', 'Title', 'Size', 'Assignee(s)', 'Previous status']) {
        const cell = document.createElement('th');
        cell.textContent = heading;
        row.appendChild(cell);
    }
    table.appendChild(row);

    area.appendChild(table);
    return table;
}

function addRow(table, issueId, issueTitle, size, assignees, previousColumn) {
    const row = document.createElement('tr');
    addCell(row, issueId);
    addCell(row, issueTitle);
    addCell(row, size);
    addCell(row, assignees);
    addCell(row, previousColumn);
    table.appendChild(row);
}

function addCell(row, text) {
    const cell = document.createElement('td');
    cell.textContent = text;
    row.appendChild(cell);
}

// Despite https://help.github.com/en/github/managing-your-work-on-github/transferring-an-issue-to-another-repository
// Migrating an issue between repos seemingly does cause it to lose its project history, though project membership isn't lost
function getPreviousColumn(issue) {
    if (issue.timelineItems == null) {
        return '** New Issue **';
    }
    const events = issue.timelineItems.nodes
    const targetTime = getPreviousColumnTargetDate();

    let latestChange = new Date(0);
    let latestColumn = '** New Issue **';

    for (let event of events) {
        const changeTime = new Date(event.createdAt);
        if (changeTime > latestChange && changeTime < targetTime) {
            latestChange = changeTime;
            latestColumn = event.projectColumnName;
        }
    }
    return latestColumn;
}

function getAssigneeNames(issue) {
    const assignees = issue.assignees.nodes;
    const names = assignees.map(assignee => assignee.name || assignee.login);
    if (issue.assignees.totalCount > assignees.length) {
        names.push('...');
    }
    return names.join(', ');
}

function getSize(issue) {
    if (issue.labels == null) {
        return '';
    }

    const sizeLabel = issue.labels.nodes.find(label => label.name.startsWith('size:'));
    if (typeof sizeLabel === 'undefined') {
        return '';
    }
    return sizeLabel.name.split(':')[1].trim();
}

function setPreviousColumnTargetDate(year, month, day, hour, min) {
    const input = document.getElementById('previousStatusTimeField');
    if (input.type == "text") {
        // Browser doesn't support datetime-local inputs, and has fallen back to text
        input.value = `${year}-${month}-${day} ${hour}:${min}`;
        document.getElementById('dateFormatGuide').className = '';
    } else {
        input.value = `${year}-${month}-${day}T${hour}:${min}`;
    }
}

function getPreviousColumnTargetDate() {
    return new Date(document.getElementById('previousStatusTimeField').value);
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
    const query =
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
                                        assignees(first: 3) {
                                            totalCount
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

window.addEventListener('load', (event) => {
    document.getElementById('generateButton').addEventListener('click', generateTables);

    // Set the default previous status time to noon on the day two weeks ago
    const target = new Date();
    target.setHours(target.getHours() - (24 * 7 * 2));
    setPreviousColumnTargetDate(target.getFullYear(), target.getMonth()+1, target.getDate(), 12, 00);
});

function checkForHttpErrors(response) {
    if (response.status !== 200) {
        return response.text().then(text => {
            throw `Unexpected response code ${response.status} - ${text}`
        });
    }
    return response;
}

function checkForJsonErrors(json) {
    if (json.hasOwnProperty('errors')) {
        console.error(json.errors);
        throw json.errors.map(error => error.message).join('\n');
    } else if (json.data.organization.projects.nodes.length == 0) {
        throw `Unable to find a project with name "${getProjectName()}" in organisation "${getOrganisationName()}"`;
    }
    return json;
}

function generateTables() {
    setButtonDisabledState(true);
    setProgressMessage('Fetching data');
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
    })
    .catch(error => {
        console.error(error);
        alert("An error occurred when processing:\n" + error);
    })
    .then(() => {
        setButtonDisabledState(false);
        setProgressMessage('');
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
    const headings = ['Issue ID', 'Title', 'Size', 'Assignee(s)', 'Previous status'];
    if (getAddNotesColumn()) {
        headings.push('Notes');
    }
    for (let heading of headings) {
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
    if (getAddNotesColumn()) {
        addCell(row, '');
    }
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

    year = String(year).padStart(4, '0');
    month = String(month).padStart(2, '0');
    day = String(day).padStart(2, '0');
    hour = String(hour).padStart(2, '0');
    min = String(min).padStart(2, '0');
    
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

function getAddNotesColumn() {
    return document.getElementById('addNotesCheckbox').checked;
}

function setButtonDisabledState(disabled) {
    document.getElementById('generateButton').disabled = disabled;
}

function setProgressMessage(message) {
    document.getElementById('progressMessage').innerText = message;
}

function fetchGraphQLProjectData(columnCursor = null, cardCursor = null, project = {columns:{nodes:[]}}) {
    const query =
`query ($organisation_name: String!, $project_name: String, $column_cursor: String, $card_cursor: String) {
    organization(login: $organisation_name) {
        name
        projects (first: 1 search: $project_name) {
            nodes {
                name
                columns(first: 1 after: $column_cursor) {
                    totalCount
                    pageInfo {
                        endCursor
                        hasNextPage
                    }
                    nodes {
                        name
                        cards(archivedStates: [NOT_ARCHIVED] after: $card_cursor){
                            totalCount
                            pageInfo {
                                endCursor
                                hasNextPage
                            }
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
                column_cursor: columnCursor,
                card_cursor: cardCursor
            },
        })
    })
    .then(checkForHttpErrors)
    .then(response => response.json())
    .then(checkForJsonErrors)
    .then(json => json.data.organization.projects.nodes[0])
    .then(projectResponse => {
        if (cardCursor === null) {
            // new column
            project.columns.nodes.push(projectResponse.columns.nodes[0])
        } else {
            // add cards to current column
            for (let card of projectResponse.columns.nodes[0].cards.nodes) {
                project.columns.nodes[project.columns.nodes.length - 1].cards.nodes.push(card)
            }
        }
        if (projectResponse.columns.nodes[0].cards.pageInfo.hasNextPage) {
            setProgressMessage('Fetching data for column ' + (project.columns.nodes.length) + '/' + projectResponse.columns.totalCount);
            return fetchGraphQLProjectData(columnCursor, projectResponse.columns.nodes[0].cards.pageInfo.endCursor, project);
        }
        if (projectResponse.columns.pageInfo.hasNextPage) {
            setProgressMessage('Fetching data for column ' + (project.columns.nodes.length + 1) + '/' + projectResponse.columns.totalCount);
            return fetchGraphQLProjectData(projectResponse.columns.pageInfo.endCursor, null, project);
        }
        return project
    });
}

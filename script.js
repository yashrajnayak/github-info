document.addEventListener('DOMContentLoaded', function() {
    // DOM element selectors
    const accessTokenInput = document.getElementById('accessToken');
    const usernamesTextarea = document.getElementById('usernames');
    const fetchButton = document.getElementById('fetchButton');
    const copyTableButton = document.getElementById('copyTableButton');
    const resultsTable = document.getElementById('resultsTable');
    const progressContainer = document.getElementById('progressContainer');
    const fetchProgress = document.getElementById('fetchProgress');
    const progressText = document.getElementById('progressText');
    const failedUsernamesContainer = document.getElementById('failedUsernames');
    const failedUsernamesList = document.getElementById('failedUsernamesList');
    const columnToggles = document.getElementById('columnToggles');

    /**
     * Formats and cleans up a GitHub username
     * @param {string} input - The input username
     * @return {string} The formatted username
     */
    function formatUsername(input) {
        input = input.trim();
        // Remove GitHub URL if present
        input = input.replace(/^(https?:\/\/)?(www\.)?github\.com\//, '');
        // Remove trailing slash
        input = input.replace(/\/$/, '');
        // Remove @ sign if present
        input = input.replace('@', '');
        // Remove any non-alphanumeric characters except dash and underscore
        input = input.replace(/[^a-zA-Z0-9-_]/g, '');
        return input;
    }

    /**
     * Copies the table content to clipboard
     */
    function copyTableContent() {
        const rows = resultsTable.querySelectorAll('tr');
        let copyText = '';

        rows.forEach((row, index) => {
            const cells = row.querySelectorAll('th, td');
            const rowData = Array.from(cells).map(cell => cell.textContent.trim());
            copyText += rowData.join('\t') + '\n';
        });

        navigator.clipboard.writeText(copyText).then(() => {
            const originalText = copyTableButton.textContent;
            const originalColor = copyTableButton.style.backgroundColor;

            // Change button text and color
            copyTableButton.textContent = 'Table Copied to Clipboard';
            copyTableButton.style.backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--button-bg').trim();

            // Reset button after 2 seconds
            setTimeout(() => {
                copyTableButton.textContent = originalText;
                copyTableButton.style.backgroundColor = originalColor;
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy table: ', err);
            alert('Failed to copy table. Please try again.');
        });
    }

    // Add event listener to fetch button if it exists
    fetchButton.addEventListener('click', fetchGitHubData);

    // Copy table functionality
    if (copyTableButton) {
        copyTableButton.addEventListener('click', copyTableContent);
    }

    // Update the table header
    const tableHeader = resultsTable.querySelector('thead tr');
    if (tableHeader) {
        tableHeader.innerHTML = `
            <th>Username</th>
            <th>Name</th>
            <th class="toggleable" style="display: none;">Bio</th>
            <th class="toggleable">Repositories</th>
            <th class="toggleable">Stars</th>
            <th class="toggleable">Forks</th>
            <th class="toggleable">Followers</th>
            <th class="toggleable">Company</th>
            <th class="toggleable">Organizations</th>
        `;
    }

    /**
     * Fetches GitHub data for the provided usernames
     */
    async function fetchGitHubData() {
        const accessToken = accessTokenInput.value.trim();
        let usernames = usernamesTextarea.value.trim().split(/[,\n\s]+/);
        usernames = usernames.map(formatUsername).filter(username => username !== '');
        usernamesTextarea.value = usernames.join('\n');

        // Clear previous results and reset UI
        const tableBody = resultsTable.querySelector('tbody');
        if (tableBody) {
            tableBody.innerHTML = ''; // Clear only the table body
        }
        if (copyTableButton) {
            copyTableButton.style.display = 'none';
        }
        if (failedUsernamesContainer) {
            failedUsernamesContainer.style.display = 'none';
        }
        if (failedUsernamesList) {
            failedUsernamesList.innerHTML = '';
        }

        if (!accessToken) {
            alert('Please enter a GitHub Personal Access Token');
            return;
        }

        // Show progress indicator
        if (progressContainer) {
            progressContainer.style.display = 'block';
        }
        if (fetchProgress) {
            fetchProgress.value = 0;
        }
        if (progressText) {
            progressText.textContent = '0%';
        }

        let completedRequests = 0;
        const totalRequests = usernames.length;
        const failedUsernames = [];

        const headers = {
            'Authorization': `token ${accessToken}`,
            'If-None-Match': ''
        };

        for (const username of usernames) {
            try {
                // Fetch user data
                const userResponse = await fetch(`https://api.github.com/users/${username}`, { headers });
                if (!userResponse.ok) {
                    throw new Error(`HTTP error! status: ${userResponse.status}`);
                }
                const userData = await userResponse.json();

                headers['If-None-Match'] = userResponse.headers.get('ETag') || '';

                let totalStars = 0;
                let totalForks = 0;

                if (userData.public_repos > 0) {
                    const reposPerPage = 100;
                    const pagesCount = Math.ceil(userData.public_repos / reposPerPage);

                    for (let page = 1; page <= pagesCount; page++) {
                        const reposResponse = await fetch(
                            `https://api.github.com/users/${username}/repos?page=${page}&per_page=${reposPerPage}`,
                            { headers }
                        );
                        if (reposResponse.status === 304) {
                            break;
                        }
                        const reposData = await reposResponse.json();
                        totalStars += reposData.reduce((sum, repo) => sum + repo.stargazers_count, 0);
                        totalForks += reposData.reduce((sum, repo) => sum + repo.forks_count, 0);

                        headers['If-None-Match'] = reposResponse.headers.get('ETag') || '';
                    }
                }

                let orgNames = '';
                if (userData.organizations_url) {
                    const orgsResponse = await fetch(userData.organizations_url, { headers });
                    if (orgsResponse.ok) {
                        const orgsData = await orgsResponse.json();
                        orgNames = orgsData.map(org => org.login).join(', ');
                    } else {
                        console.error(`Failed to fetch organizations for ${username}: ${orgsResponse.status}`);
                        orgNames = 'Failed to fetch';
                    }
                } else {
                    orgNames = 'N/A';
                }

                // Add row to the table
                const row = tableBody.insertRow();
                row.innerHTML = `
                    <td>${username}</td>
                    <td>${userData.name || 'N/A'}</td>
                    <td style="display: none;">${userData.bio || 'N/A'}</td>
                    <td>${userData.public_repos}</td>
                    <td>${totalStars}</td>
                    <td>${totalForks}</td>
                    <td>${userData.followers}</td>
                    <td>${userData.company || 'N/A'}</td>
                    <td>${orgNames}</td>
                `;

                // Check rate limit
                const remainingRequests = userResponse.headers.get('X-RateLimit-Remaining');
                if (remainingRequests && parseInt(remainingRequests) < 10) {
                    throw new Error('Approaching GitHub API rate limit. Pausing requests.');
                }

            } catch (error) {
                console.error(`Error fetching data for ${username}:`, error);
                failedUsernames.push(username);
                if (error.message.includes('rate limit')) {
                    alert('Approaching GitHub API rate limit. Please try again later.');
                    break;
                }
            } finally {
                completedRequests++;
                updateProgress(completedRequests, totalRequests);
            }

            // Add a small delay between requests
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        progressContainer.style.display = 'none';
        accessTokenInput.style.display = 'none';
        usernamesTextarea.style.display = 'none';
        fetchButton.style.display = 'none';
        
        const buttonContainer = document.querySelector('.button-container');
        if (buttonContainer) {
            buttonContainer.style.display = 'flex';
        }
        
        if (copyTableButton) {
            copyTableButton.style.display = 'inline-block';
        }
        if (resetButton) {
            resetButton.style.display = 'inline-block';
        }
        if (columnToggles) {
            columnToggles.style.display = 'flex';
            createColumnToggles();
        }

        // Display failed usernames if any
        if (failedUsernames.length > 0) {
            if (failedUsernamesContainer) {
                failedUsernamesContainer.style.display = 'block';
            }
            if (failedUsernamesList) {
                failedUsernamesList.innerHTML = '';
                failedUsernames.forEach(username => {
                    const li = document.createElement('li');
                    li.textContent = username;
                    failedUsernamesList.appendChild(li);
                });
            }
        } else {
            if (failedUsernamesContainer) {
                failedUsernamesContainer.style.display = 'none';
            }
        }
    }

    /**
     * Updates the progress bar and text
     * @param {number} completed - Number of completed requests
     * @param {number} total - Total number of requests
     */
    function updateProgress(completed, total) {
        const percentage = Math.round((completed / total) * 100);
        if (fetchProgress) {
            fetchProgress.value = percentage;
        }
        if (progressText) {
            progressText.textContent = `${percentage}%`;
        }
    }

    // Theme switcher
    const themeToggle = document.getElementById('themeToggle');
    const currentTheme = localStorage.getItem('theme');
    const themeLabel = document.getElementById('themeLabel');

    if (currentTheme) {
        document.documentElement.setAttribute('data-theme', currentTheme);
        themeToggle.checked = currentTheme === 'dark';
        themeLabel.textContent = currentTheme === 'dark' ? 'Dark' : 'Light';
    }

    function switchTheme(e) {
        if (e.target.checked) {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
            themeLabel.textContent = 'Dark';
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
            localStorage.setItem('theme', 'light');
            themeLabel.textContent = 'Light';
        }    
    }

    themeToggle.addEventListener('change', switchTheme);

    const resetButton = document.createElement('button');
    resetButton.textContent = 'Reset';
    resetButton.id = 'resetButton';
    resetButton.style.display = 'none';

    // Add reset button next to copy table button
    copyTableButton.parentNode.insertBefore(resetButton, copyTableButton.nextSibling);

    let resetClickCount = 0;
    let resetTimeout;

    resetButton.addEventListener('click', function() {
        resetClickCount++;
        if (resetClickCount === 1) {
            resetButton.textContent = 'Click Again to Reset';
            resetTimeout = setTimeout(() => {
                resetButton.textContent = 'Reset';
                resetClickCount = 0;
            }, 3000); // Reset after 3 seconds if not clicked again
        } else if (resetClickCount === 2) {
            clearTimeout(resetTimeout);
            window.location.reload();
        }
    });

    function createColumnToggles() {
        const headers = document.querySelectorAll('#resultsTable th.toggleable');
        columnToggles.innerHTML = ''; // Clear existing toggles
        headers.forEach((header, index) => {
            const toggle = document.createElement('label');
            toggle.className = 'toggle-switch';
            const isChecked = header.style.display !== 'none';
            toggle.innerHTML = `
                <input type="checkbox" ${isChecked ? 'checked' : ''}>
                <span class="toggle-slider"></span>
                <span>${header.textContent}</span>
            `;
            toggle.querySelector('input').addEventListener('change', function() {
                const isChecked = this.checked;
                const columnIndex = Array.from(headers).indexOf(header) + 3; // +3 because Username and Name are not toggleable
                const cells = document.querySelectorAll(`#resultsTable td:nth-child(${columnIndex}), #resultsTable th:nth-child(${columnIndex})`);
                cells.forEach(cell => cell.style.display = isChecked ? '' : 'none');
            });
            columnToggles.appendChild(toggle);
        });
    }
});

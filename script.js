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

    // Check if all necessary elements exist
    if (!accessTokenInput || !usernamesTextarea || !fetchButton || !resultsTable || 
        !progressContainer || !fetchProgress || !progressText || 
        !failedUsernamesContainer || !failedUsernamesList) {
        console.error('One or more required DOM elements are missing');
    }

    // Function to format and clean up usernames
    function formatUsername(input) {
        // Remove leading/trailing whitespace
        input = input.trim();

        // Remove 'https://github.com/' or 'github.com/' if present
        input = input.replace(/^(https?:\/\/)?(www\.)?github\.com\//, '');

        // Remove any trailing slash
        input = input.replace(/\/$/, '');

        // Remove any email addresses
        if (input.includes('@')) {
            return '';
        }

        // Remove any non-alphanumeric characters except dash and underscore
        input = input.replace(/[^a-zA-Z0-9-_]/g, '');

        return input;
    }

    // Function to copy table content
    function copyTableContent() {
        const table = document.getElementById('resultsTable');
        const rows = table.querySelectorAll('tr');
        let copyText = '';

        rows.forEach(row => {
            const cells = row.querySelectorAll('th, td');
            const rowData = Array.from(cells).map(cell => cell.textContent.trim());
            copyText += rowData.join('\t') + '\n';
        });

        navigator.clipboard.writeText(copyText).then(() => {
            alert('Table copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy table: ', err);
            alert('Failed to copy table. Please try again.');
        });
    }

    // Add event listener to copy button if it exists
    if (copyTableButton) {
        copyTableButton.addEventListener('click', copyTableContent);
    }

    // Main fetch function
    async function fetchGitHubData() {
        const accessToken = accessTokenInput.value.trim();
        let usernames = usernamesTextarea.value.trim();

        // Split usernames by commas, newlines, or spaces
        usernames = usernames.split(/[,\n\s]+/);

        // Format and filter usernames
        usernames = usernames.map(formatUsername).filter(username => username !== '');

        // Update textarea with formatted usernames
        usernamesTextarea.value = usernames.join('\n');

        if (resultsTable) {
            resultsTable.innerHTML = ''; // Clear previous results
        }
        if (copyTableButton) {
            copyTableButton.style.display = 'none'; // Hide copy button initially
        }
        if (failedUsernamesContainer) {
            failedUsernamesContainer.style.display = 'none'; // Hide failed usernames container
        }
        if (failedUsernamesList) {
            failedUsernamesList.innerHTML = ''; // Clear previous failed usernames
        }

        if (!accessToken) {
            alert('Please enter a GitHub Personal Access Token');
            return;
        }

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

        for (const username of usernames) {
            try {
                const userData = await fetch(`https://api.github.com/users/${username}`, {
                    headers: { Authorization: `token ${accessToken}` }
                }).then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    return response.json();
                });

                const [reposData, orgsData] = await Promise.all([
                    fetch(`https://api.github.com/users/${username}/repos`, {
                        headers: { Authorization: `token ${accessToken}` }
                    }).then(response => response.json()),
                    fetch(`https://api.github.com/users/${username}/orgs`, {
                        headers: { Authorization: `token ${accessToken}` }
                    }).then(response => response.json())
                ]);

                const totalStars = reposData.reduce((sum, repo) => sum + repo.stargazers_count, 0);
                const totalForks = reposData.reduce((sum, repo) => sum + repo.forks_count, 0);
                const orgNames = orgsData.map(org => org.login).join(', ');

                const row = resultsTable.insertRow();
                row.innerHTML = `
                    <td>${username}</td>
                    <td>${userData.name || 'N/A'}</td>
                    <td>${totalStars}</td>
                    <td>${totalForks}</td>
                    <td>${reposData.length}</td>
                    <td>${userData.followers}</td>
                    <td>${userData.company || 'N/A'}</td>
                    <td>${orgNames || 'N/A'}</td>
                `;
            } catch (error) {
                console.error(`Error fetching data for ${username}:`, error);
                failedUsernames.push(username);
            } finally {
                completedRequests++;
                updateProgress(completedRequests, totalRequests);
            }

            // Add a small delay between requests to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        if (copyTableButton) {
            copyTableButton.style.display = 'block';
        }
        if (progressContainer) {
            progressContainer.style.display = 'none';
        }

        if (failedUsernames.length > 0 && failedUsernamesContainer && failedUsernamesList) {
            failedUsernamesContainer.style.display = 'block';
            failedUsernames.forEach(username => {
                const li = document.createElement('li');
                li.textContent = username;
                failedUsernamesList.appendChild(li);
            });
        }
    }

    // Progress update function
    function updateProgress(completed, total) {
        const percentage = Math.round((completed / total) * 100);
        if (fetchProgress) {
            fetchProgress.value = percentage;
        }
        if (progressText) {
            progressText.textContent = `${percentage}%`;
        }
    }

    // Add event listener to fetch button
    if (fetchButton) {
        fetchButton.addEventListener('click', fetchGitHubData);
    }
});

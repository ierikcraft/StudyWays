export function login() {
    window.location.href = 'https://erikaccount.vercel.app/?from=studyways';
}

export function logout() {
    localStorage.removeItem('studyways_user');
    window.location.reload();
}

export function getUser() {
    const user = localStorage.getItem('studyways_user');
    return user ? JSON.parse(user) : null;
}

export function handleAuthCallback() {
    const params = new URLSearchParams(window.location.search);
    const name = params.get('name');
    const mail = params.get('email');
    const id = params.get('id');

    if (name && mail && id) {
        const user = { name, mail, id };
        localStorage.setItem('studyways_user', JSON.stringify(user));

        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
        return user;
    }
    return null;
}

const port = window.location.port;
const ws = new WebSocket('ws://localhost:' + port);
console.log(port);


ws.onopen = () => {
    console.log('connected');
    ws.send(window.location.pathname);
    ws.onmessage = (message) => {
        // replace the content of the whole page with the message
        document.documentElement.innerHTML = message.data;
    };
};
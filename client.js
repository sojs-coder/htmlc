var ws = new WebSocket('ws://localhost:' + window.location.port);
ws.onopen = () => {
    console.log('connected');
    ws.send(window.location.pathname);
    ws.onmessage = (message) => {
        window.location.reload();
        // // replace the head with the new head
        // const rawHTML = message.data;
        // const parser = new DOMParser();
        // const doc = parser.parseFromString(rawHTML, 'text/html');
        // const newHead = doc.head;
        // const newBody = doc.body;
        // const head = document.head;
        // head.innerHTML = newHead.innerHTML;
        // const body = document.body;
        // body.innerHTML = newBody.innerHTML;
        // // rerun scripts
        // // Remove old scripts
        // const oldScripts = document.getElementsByTagName('script');
        // for (let i = oldScripts.length - 1; i >= 0; i--) {
        //     if (!oldScripts[i].getAttribute("data-keep") || oldScripts[i].getAttribute("data-keep") != "true") {
        //         oldScripts[i].parentNode.removeChild(oldScripts[i]);
        //     }
        // }

        // // Append new scripts
        // const scripts = doc.getElementsByTagName('script');
        // for (let i = 0; i < scripts.length; i++) {
        //     scripts[]
        //     document.body.appendChild(scripts[i]);
        // }
    };
};
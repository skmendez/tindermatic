function handleFileSelect(evt) {
    let f = evt.target.files[0];
    let p = getJsonPromise(f);
    p.then(function (json) {
        let output = processData(json);
        sessionStorage.setItem("data", output);
        //alert(output);
        window.location.href = "build/index.html";
    });
}

function getJsonPromise(file) {
    let promise;
    if (file.name.endsWith("zip")) {
        let zip = new JSZip();
        promise = zip.loadAsync(file)
            .then(function (zip) {
                // process ZIP file content here
                return zip.files["data.json"].async("string")
            }, function () {
                alert("Not a valid zip file")
            });
    } else {

        let temporaryFileReader = new FileReader();

        promise = new Promise((resolve, reject) => {
            temporaryFileReader.onerror = () => {
                temporaryFileReader.abort();
                reject(new DOMException("Problem parsing input file."));
            };

            temporaryFileReader.onload = () => {
                resolve(temporaryFileReader.result);
            };
            temporaryFileReader.readAsText(file);
        });
    }
    return promise.then(JSON.parse)
}

function processData(data) {


    function sum(array) {
        return array.reduce((total, curr) => total + curr, 0)
    }

    const leftSwipes = sum(Object.values(data.Usage.swipes_passes));
    const rightSwipes = sum(Object.values(data.Usage.swipes_likes));
    const matches = sum(Object.values(data.Usage.matches));
    const messaged = data.Messages.length;
    const multipleMessages = function (array) {
        let sum = 0;
        array.forEach(function (value) {
            if (value.messages.length > 1) {
                sum += 1;
            }
        });
        return sum;

    }(data.Messages);

    return `Swipe [${leftSwipes}] Left swipe
Swipe [${rightSwipes}] Right swipe #00CC00
Right swipe [${rightSwipes - matches}] No match
Right swipe [${matches}] Match #00CC00
Match [${matches - messaged}] No message
Match [${messaged}] Messaged #00CC00
Messaged [${messaged - multipleMessages}] Single Message
Messaged [${multipleMessages}] Multiple Messages #00CC00`
}

window.onload = () => document.getElementById('files').addEventListener('change', handleFileSelect, false);

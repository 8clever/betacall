export default sendFile

/**
 * file object from Browser
 * you can receive this object simple from ReactFileReader
 * 
 * @prop file
 * @prop file.name
 * @prop file.type
 * @prop file.size
 */

async function sendFile(file) {
    let uri = "/file/upload";
    let xhr = new XMLHttpRequest();
    let fd = new FormData();
    
    xhr.open("POST", uri, true);
    return new Promise((resolve, reject) => {
        xhr.onreadystatechange = (e) => {
            if (xhr.readyState !== 4) return;
            if (xhr.status == 200) {
                let data = JSON.parse(e.currentTarget.responseText);
                return resolve(data);
            }
            let error = new Error(e.currentTarget.responseText);
            error.subject = e.currentTarget.statusText;
            reject(error);
        };
        fd.append(file.name, file);
        xhr.send(fd);
    });
}
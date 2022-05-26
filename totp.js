if (typeof browser === "undefined") {
    var browser = chrome;
}

var open_panel = ""                                 // ???
var editing_profile = -1;                           // the id of the profile currently being edited; -1 if none
var secrets = []                                    // array of profile objects
var title_thing = "Alice's Authenticator"           // the name to show at the top of the popup
var password = ""                                   // the currently entered password
var signed_in = false                               // whether or not the user is signed in
var verification_test = "(Top of the Pops 1997)"    // phrase that's used to make sure the user's password is correct
var theme_colour = "teal"                           // name of the colour used for ui accents

var question_yes_action = () => { console.log("Question not setup") }
var question_no_action = () => { console.log("Question not setup") }

// Function to download data to a file
// from https://stackoverflow.com/a/30832210
function download(data, filename, type) {
    var file = new Blob([data], { type: type });
    if (window.navigator.msSaveOrOpenBlob) // IE10+
        window.navigator.msSaveOrOpenBlob(file, filename);
    else { // Others
        var a = document.createElement("a"),
            url = URL.createObjectURL(file);
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(function() {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 0);
    }
}


//-----------------------------------------------
//  export and import secrets
//-----------------------------------------------

/**
 * Exports the secrets to a JSON file
 */
function export_secrets() {
    download(JSON.stringify({
        secrets: secrets
    }), "secrets.json", "application/json")
}

/**
 * Imports the secrets from a JSON file
 */
function import_secrets() {
    document.getElementById("input-import-secrets").click();
}

// event listener for when a file is selected using import secrets
document.getElementById("input-import-secrets").addEventListener("change", (event) => {

    var files = event.target.files;
    if (files.length > 0) {
        var file = files[0]
        var reader = new FileReader();
        reader.onloadend = function() {

            var temp_secrets = JSON.parse(reader.result)

            if ("secrets" in temp_secrets) {

                // remove local secrets
                //while (secrets.length > 0) secrets.splice(0)

                // import new secrets
                for (secret of temp_secrets.secrets) secrets.push(secret)

                console.log(temp_secrets)
                set_status("Successfully imported secrets!")
                set_error("")
                populate_table_thing()
                store_profiles()

            } else set_error("Invalid secrets file!")

        }
        reader.readAsText(file);
    }

})

/**
 * Opens a file select dialog for selecting a QR code with OTP auth data
 */
function scan_qr_code() {
    document.getElementById("input-scan-qr-code").click();
}

// onchange listener for QR code input
document.getElementById("input-scan-qr-code").addEventListener("change", (event) => {

    var files = event.target.files;
    if (files.length > 0) {
        var file = files[0]

        // get ImageData from a local image file
        // from https://stackoverflow.com/a/36394704
        var url = URL.createObjectURL(file) // create an Object URL
        var img = new Image(); // create a temp. image object

        img.onload = function() { // handle async image loading

            URL.revokeObjectURL(this.src); // free memory held by Object URL
            var c = document.createElement("canvas")
            var ctx = c.getContext("2d")
            c.width = img.width;
            c.height = img.height;

            ctx.drawImage(this, 0, 0); // draw image onto canvas (lazy method™)
            var idata = ctx.getImageData(0, 0, c.width, c.height);
            console.log(idata)

            // parse the image data as a QR code
            var qr = jsQR(idata.data, idata.width, idata.height)
            if (qr) {

                // if a qr code was detected, populate the profile form fields
                const qr_data = parseURI(qr.data)
                console.log("found qr code", qr, qr_data)


                // add issuer name and account name
                if ("issuer" in qr_data.query) document.getElementById("edit-name").value = qr_data.query.issuer
                else if ("issuer" in qr_data.label) document.getElementById("edit-name").value = qr_data.label.issuer
                if (("issuer" in qr_data.label || "issuer" in qr_data.query) && "account" in qr_data.label) document.getElementById("edit-name").value += " - "
                if ("account" in qr_data.label) document.getElementById("edit-name").value += qr_data.label.account

                // add secret, code length, and duration
                if ("secret" in qr_data.query) document.getElementById("edit-secret").value = qr_data.query.secret
                if ("digits" in qr_data.query) document.getElementById("edit-otp-length").value = qr_data.query.digits
                if ("period" in qr_data.query) document.getElementById("edit-otp-time").value = qr_data.query.period
                    // if ("algorithm" in qr_data.query) document.getElementById("edit-algorithm").value = qr_data.query.algorithm

            } else {
                console.warn("Couldn't find QR code")
                set_error("Couldn't find QR code in image")
            }
        };

        img.src = url; // start convertion file to image
    }
})

//-----------------------------------------------
//  local storage functions
//-----------------------------------------------

/**
 * Save secrets and sign in info to local browser storage
 */
function store_profiles() {
    browser.storage.local.set({
        profiles: secrets,
        signed_in
    }).then(() => {
        console.log("wrote profiles!")
    }).catch(err => {
        console.error("error writing profiles", err)
        set_error("Error writing profiles", err)
    })
}

/**
 * Load secrets and sign in info from local browser storage
 * @param {*} popup should be true if being called as part of the extension popup initalisation process
 */
function load_profiles(popup = false) {

    browser.storage.local.get(null).then(res => {

        console.log("got profiles:", res)
        secrets = res.profiles || []
        signed_in = res.signed_in || false
        password = res.password || ""
        populate_table_thing()

        if (popup) {
            user_data_exists().then(() => {
                if (signed_in) switch_panel("panel-profiles")
                else switch_panel("panel-signin")
            }).catch(err => {
                switch_panel("panel-intro")
            })
        }

    }).catch(err => {

        console.error("error getting profiles", err)
        set_error("Error getting profiles", err)
        secrets = []
        switch_panel("panel-profiles")

    })
}

//-----------------------------------------------
//  general extension functions
//-----------------------------------------------

/**
 * Register an event listener that listens for buttons on the extension interface being clicked
 */
function listenForClicks() {
    console.log("adding event listener")
    document.addEventListener("click", (e) => {

        if (e.target.classList.contains("send_totp")) {
            browser.tabs.query({ active: true, currentWindow: true })
                .then(() => {
                    send_totp(e)
                })
                .catch(err => {
                    console.error(`Error: ${error}`);
                    set_error("Error generating TOTP", err);
                });
        } else if (e.target.classList.contains("close_edit_panel")) {
            switch_panel("panel-profiles")
        } else if (e.target.classList.contains("save_edit_panel")) {
            save_profile()
        } else if (e.target.classList.contains("edit_profile")) {
            edit_profile(e.target.dataset.id)
        } else if (e.target.classList.contains("new_profile")) {
            edit_profile(-1)
        } else if (e.target.classList.contains("remove_profile")) {

            ask_question("Are you sure you want to remove this profile?", () => {
                remove_profile(e.target.dataset.id)
            }, () => {
                // nothing
            });


        } else if (e.target.classList.contains("open_settings")) {
            switch_panel("panel-settings")
        } else if (e.target.classList.contains("export_secrets")) {
            export_secrets()
        } else if (e.target.classList.contains("import_secrets")) {
            import_secrets()
        } else if (e.target.classList.contains("scan_qr_code")) {
            scan_qr_code()
        } else if (e.target.classList.contains("signin")) {
            signin()
        } else if (e.target.classList.contains("signout")) {
            signout()
        } else if (e.target.classList.contains("clear_data")) {


            ask_question("Are you sure you want to clear all\nuser data?  This can't be undone.", () => {
                clear_user_data()
            }, () => {
                // nothing
            });

        } else if (e.target.classList.contains("signin_intro")) {
            write_verification_data()
        } else if (e.target.classList.contains("question_no")) {
            question_no_action()
        } else if (e.target.classList.contains("question_yes")) {
            question_yes_action()
        } else if (e.target.classList.contains("inject_colour")) {

            ask_question("Do you want to inject the Colour Script?", () => {
                browser.tabs.executeScript({ file: "colour_inject.js" })
            }, () => {
                // nothing
            });

        } else if (e.target.classList.contains("inject_colour_reset")) {

            ask_question("Do you want to reset the Colour Script?", () => {
                browser.tabs.executeScript({ file: "colour_inject_reset.js" })
            }, () => {
                // nothing
            });

        }
    })
}

/**
 * Clears the profiles table, then populates it with profile names and icons and buttons
 */
function populate_table_thing() {

    var table = document.getElementById("profile-table")

    // clear table
    while (table.childElementCount > 0) table.removeChild(table.firstChild)

    // add profiles to table
    if (secrets.length > 0) {
        document.getElementById("no-profiles-message").style.display = "none"
        for (var i = 0; i < secrets.length; i++) {

            var secret = secrets[i]
            console.log(secret)

            // insert new row
            var row_id = Math.floor(100000 + Math.random() * 900000)
            var row = table.insertRow(-1);
            row.setAttribute("draggable", true)
            row.dataset.id = i;
            row.ondrop = handle_drop;
            row.ondragover = event => {
                event.preventDefault()
                event.dataTransfer.dropEffect = "move"
            }

            // insert icon
            var cell_icon = row.insertCell(-1);
            cell_icon.classList.add("profile-icon")
            cell_icon.innerHTML = "<img class='icon' src='" + secret.icon + "'>"
            cell_icon.dataset.id = i;

            // insert profile name
            var profile_name = document.createElement("div")
            profile_name.classList.add("profile-name")
            profile_name.style.verticalAlign = "middle";
            profile_name.innerText = secret.name;
            profile_name.dataset.id = i;

            // insert totp timer
            var profile_timer = document.createElement("span")
            profile_timer.id = "timer" + i.toString()
            profile_timer.classList.add("profile-timer")
            profile_name.dataset.id = i;

            // space
            // var profile_space = document.createElement("span")
            // profile_space.innerHTML = "&nbsp;"
            // profile_space.dataset.id = i;

            // insert totp code
            var profile_code = document.createElement("span")
            profile_code.id = "secret" + i.toString()
            profile_code.dataset.id = i;
            profile_code.classList.add("profile-code")
                // profile_code.innerText = 123456
            profile_code.onclick = event => {
                console.log("Clicked on code", event)

                // copy code
                var code = event.target.innerText;
                navigator.clipboard.writeText(code)
                var copied = true

                // set text to copied!
                event.target.innerText = "Copied!"

                // set text back to code (after 1 second)
                setTimeout(() => {
                    copied = false;
                    event.target.innerText = code;
                }, 1000)

            }

            // add name, timer, space, and code to a container
            var profile_name_container = document.createElement("div")
            profile_name_container.classList.add("profile-name-container")
            profile_name_container.appendChild(profile_name)
            profile_name_container.appendChild(profile_code)
                // profile_name_container.appendChild(profile_space)
            profile_name_container.appendChild(profile_timer)
            profile_name_container.dataset.id = i;

            // insert the container
            var cell_name = row.insertCell(-1);
            cell_name.style.verticalAlign = "middle"
            cell_name.appendChild(profile_name_container)
            cell_name.dataset.id = i;

            // add the generate button
            var cell_button = row.insertCell(-1);
            cell_button.classList.add("profile-button")
            cell_button.innerHTML = "<div class='button icon_btn send_totp' data-id='" + i + "' title='Generate!'><i class='fa fa-refresh' aria-hidden='true'></i></div>";
            cell_button.dataset.id = i;

            // add edit button
            var cell_edit = row.insertCell(-1);
            cell_edit.classList.add("profile-button")
            cell_edit.innerHTML = "<div class='button icon_btn edit_profile' data-id='" + i + "' title='Edit Profile'><i class='fa fa-pencil' aria-hidden='true'></i></div>";
            cell_edit.dataset.id = i;

            var cell_remove = row.insertCell(-1);
            cell_remove.classList.add("profile-button")
            cell_remove.title = "Remove Profile"
            cell_remove.innerHTML = "<div class='button icon_btn remove_profile' data-id='" + i + "' title='Remove Profile'><i class='fa fa-times' aria-hidden='true'></i></div>";
            cell_remove.dataset.id = i;

        }

    } else document.getElementById("no-profiles-message").style.display = "block"
}

/**
 * Sets the error message at the bottom of the interface
 * @param {string} error error text to show
 * @param {string} tooltip extra info to show as a tooltip when the cursor hovers over the error
 */
function set_error(error, tooltip = null) {
    document.getElementById("error-message").innerText = error;
    if (tooltip) document.getElementById("error-message").title = tooltip;
    else document.getElementById("error-message").title = "";

}

/**
 * Sets the status message at the bottom of the interface
 * @param {string} status the message to show
 */
function set_status(status) {
    document.getElementById("status-message").innerText = status;
}

/**
 * Calculate a TOTP code, write it to the extension interface, and attempt to add it to a field in the main document.
 * Should be called from the button event listener
 * @param {*} e the event fired by the event listener
 */
function send_totp(e) {
    fetch("https://worldtimeapi.org/api/timezone/Etc/UTC")
        .then(res => res.json())
        .then(data => {

            // get TOTP parameters
            var secret_id = e.target.dataset.id
            var secret = CryptoJS.AES.decrypt(secrets[secret_id].secret, password).toString(CryptoJS.enc.Utf8)
            var code_length = secrets[secret_id].length || 6; // number of digits in the code
            var code_time = secrets[secret_id].time || 30; // code expiry time in seconds
            var element_id = secrets[secret_id].field; // id of field to add code to
            var xpath = secrets[secret_id].xpath;      // xpath of the field aaaaaaaaaaaaa
            var internet_time_ms = data.unixtime * 1000 // js unix time (milliseconds)
            
            // get TOTP code
            var totp = new jsOTP.totp(code_time, code_length);
            var totp_code = totp.getOtp(secret, internet_time_ms) // totp code

            // calculate time left
            var seconds_left = code_time - (Math.floor(internet_time_ms/1000) % code_time)

            // write code to html
            var code_thing = document.getElementById("secret" + secret_id.toString())
            code_thing.innerText = totp_code

            // setup timer thing
            var timer_thing = document.getElementById("timer" + secret_id.toString())
            timer_thing.innerText = " (" + seconds_left.toString() + ")"

            var timer_interval = setInterval(() => {
                seconds_left--;
                if (seconds_left == -1) {
                    clearInterval(timer_interval)
                    code_thing.innerText = ""
                    timer_thing.innerText = ""
                    send_totp(e)
                } else timer_thing.innerText = " (" + seconds_left.toString() + ")"
            }, 1000)

            // inject code into page
            browser.tabs.executeScript({
                code: "var config = " + JSON.stringify({
                    input_id: element_id,
                    xpath: xpath,
                    value: totp_code
                })
            }).then(() => {
                return browser.tabs.executeScript({
                    file: "/totp_inject.js"
                })
            }).then(() => {
                // it worked
                set_error("")
            }).catch(err => {
                // document.querySelector("#popup-content").classList.add("hidden");
                // document.querySelector("#error-content").classList.remove("hidden");
                console.error("Failed to inject script", err)
                set_error("Failed to inject field loader script", err)
            })
        }).catch(err => {
            console.error("fetch time error", err)
            set_error("Failed to get internet time", err)
        })
}

/**
 * Switch to a different panel
 * @param {string} panel_name the id of the panel div to switch to
 */
function switch_panel(panel_name) {

    // close current panel
    var current_panel = document.getElementById(open_panel)
    if (current_panel) {
        current_panel.style.display = "none";
    } else console.warn("panel", open_panel, "doesn't exist")

    // open new panel
    var new_panel = document.getElementById(panel_name)
    if (new_panel) {
        new_panel.style.display = "block";
        open_panel = panel_name;
        if (panel_name == "panel-profiles") document.getElementById("title").innerText = title_thing;
        if (panel_name == "panel-settings") document.getElementById("title").innerText = "Settings";
        if (panel_name == "panel-question") document.getElementById("title").innerText = "Confirmation";
        set_status("")
    } else console.warn("panel", panel_name, "doesn't exist")


}

/**
 * Switches to the question panel to get the user to confirm an action
 * @param {string} question the (yes / no) question to ask the user
 * @param {function} yes_action the function to call when the user clicks yes
 * @param {function} no_action the function to call when the user clicks no
 * @param {*} return_panel the id of the panel to return to when the user has answered
 * @returns a Promise
 */
function ask_question(question, yes_action, no_action, return_panel = open_panel) {

    // set the question text
    document.getElementById("question-text").innerText = question;

    // go to the question panel
    switch_panel("panel-question")


    question_yes_action = () => {

        yes_action();

        // go back to the source panel
        switch_panel(return_panel)

    }

    question_no_action = () => {

        no_action();

        // go back to the source panel
        switch_panel(return_panel)



    }
}

//-----------------------------------------------
//  profile thing functions
//-----------------------------------------------

/**
 * Populates the edit form (if editing an existing profile), and switches to the edit panel
 * @param {number} profile_index the index of the profile
 */
function edit_profile(profile_index) {

    if (profile_index >= 0) {

        document.getElementById("title").innerText = "Edit Profile"

        // get profile
        var secret = secrets[profile_index]
        console.log(secret)

        // populate the profile fields
        document.getElementById("edit-name").value = secret.name
        document.getElementById("edit-secret").value = CryptoJS.AES.decrypt(secret.secret, password).toString(CryptoJS.enc.Utf8)
        document.getElementById("edit-icon").value = ""
        document.getElementById("edit-icon-btn").innerText = "Upload a new icon"
        document.getElementById("edit-field").value = secret.field || ""
        document.getElementById("edit-xpath").value = secret.xpath || ""
        document.getElementById("edit-otp-length").value = secret.length
        document.getElementById("edit-otp-time").value = secret.time
    } else {

        document.getElementById("title").innerText = "New Profile"

        // populate the profile fields
        document.getElementById("edit-name").value = ""
        document.getElementById("edit-secret").value = ""
        document.getElementById("edit-field").value = ""
        document.getElementById("edit-xpath").value = ""
        document.getElementById("edit-otp-length").value = "6"
        document.getElementById("edit-otp-time").value = "30"
    }

    // set the editing profile
    editing_profile = profile_index

    // switch to the editing panel
    switch_panel("panel-edit")
}

/**
 * Saves the profile that is currently being edited
 */
function save_profile() {

    function save() {
        // store profile stuff
        store_profiles()

        // regenerate profile table
        populate_table_thing()

        // go to profile panel
        switch_panel("panel-profiles")
    }


    var latest_secret = -1;
    // if saving an new profile
    if (editing_profile == -1) {

        //console.log(CryptoJS.AES.encrypt(document.getElementById("edit-secret").value, password))

        // save profile info
        secrets.push({
            "name": document.getElementById("edit-name").value,
            "secret": CryptoJS.AES.encrypt(document.getElementById("edit-secret").value, password).toString(),
            "field": document.getElementById("edit-field").value,
            "xpath": document.getElementById("edit-xpath").value,
            "icon": icon_data,
            "length": document.getElementById("edit-otp-length").value,
            "time": document.getElementById("edit-otp-time").value
        })
        latest_secret = secrets.length - 1;
    } else {

        //console.log(CryptoJS.AES.encrypt(document.getElementById("edit-secret").value, password).toString())

        secrets[editing_profile].name = document.getElementById("edit-name").value;
        secrets[editing_profile].secret = CryptoJS.AES.encrypt(document.getElementById("edit-secret").value, password).toString();
        secrets[editing_profile].field = document.getElementById("edit-field").value;
        secrets[editing_profile].xpath = document.getElementById("edit-xpath").value;
        secrets[editing_profile].length = document.getElementById("edit-otp-length").value;
        secrets[editing_profile].time = document.getElementById("edit-otp-time").value;

        latest_secret = editing_profile
    }

    // get icon
    var icon_data = ""
    var icon_input = document.getElementById("edit-icon");
    var files = icon_input.files;
    if (files.length > 0) // if at least one file was selected
    {
        var file = files[0];
        var reader = new FileReader();
        reader.onloadend = function() {
            // console.log('RESULT', reader.result)
            secrets[latest_secret].icon = reader.result
            console.log(secrets[latest_secret])

            save()
        }
        reader.readAsDataURL(file);

    } else // use default icon
    {
        if (editing_profile == -1) secrets[latest_secret].icon = "data:image/png;base64,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"
        save()

    }

}

/**
 * Removes a profile for ever
 * @param {*} profile_id the id of the profile to remove
 */
function remove_profile(profile_id) {

    // remove the profile
    secrets.splice(profile_id, 1);

    // save profile list
    store_profiles();

    // regenerate profile table
    populate_table_thing()


}

// set the profile icon button label
var edit_icon = document.getElementById("edit-icon")
var edit_icon_btn = document.getElementById("edit-icon-btn")
edit_icon.addEventListener("change", event => {
    var files = event.target.files;
    if (files.length > 0) {
        console.log(files)
        var file = files[0]
        edit_icon_btn.innerText = file.name;
    }
})

//-----------------------------------------------
//  sign in + authentication functions
//-----------------------------------------------

/**
 * Writes a test phrase (encrypted using a password) to local storage.  The presence of this key is used
 * to detect if user data exists (ie: if a password has already been made).  It is also used to verify the
 * password when signing in.
 */
function write_verification_data() {

    var pword = document.getElementById("input-password-intro").value
    var pword2 = document.getElementById("input-password-intro-verification").value

    if (pword != pword2) {
        set_error("Passwords don't match!")
    } else {

        browser.storage.local.set({
            verification: CryptoJS.AES.encrypt(verification_test, pword).toString()
        }).then(() => {
            console.log("wrote verification test!")
            document.getElementById("input-password").value = pword
            signin()
            set_status("Created user data successfully!")
        }).catch(err => {
            console.error("error writing login info", err)
            set_error("Error creating user data", err)
        })

    }
}

/**
 * Check that a password is correct, then sign into the extension
 */
function signin() {
    print("AFUFBASFUBAFSA")
    var pword = document.getElementById("input-password").value

    browser.storage.local.get("verification").then(res => {

        console.log("got stored data:", res)
        var decoded = CryptoJS.AES.decrypt(res.verification, pword).toString(CryptoJS.enc.Utf8)
        console.log("decoded:", decoded)
        if (decoded == verification_test) {
            console.log("Password success?")

            password = pword
            signed_in = true

            browser.storage.local.set({
                signed_in
            }).then(() => {
                console.log("wrote login info!")
                set_error("")
                populate_table_thing()
                switch_panel("panel-profiles")
                document.getElementById("input-password").value = ""
                document.getElementById("input-password-intro").value = ""
            }).catch(err => {
                console.error("error writing login info", err)
                set_error("Error saving login info", err)
            })

        } else {
            set_error("Password was incorrect", "test")
        }


    }).catch(err => {

        set_error("Verification Test doesn't exist")

    })

}

/**
 * Sign out of the extension
 */
function signout() {
    password = ""
    signed_in = false

    browser.storage.local.set({
        signed_in
    }).then(() => {
        console.log("wrote login info!")
        set_error("")
        populate_table_thing()
        switch_panel("panel-signin")
    }).catch(err => {
        console.error("error writing login info", err)
        set_error("Error saving login info", err)
    })
}

/**
 * Check if user data has already been made
 * @returns a promise that resolves if user data exists, and rejects otherwise
 */
function user_data_exists() {
    return new Promise((resolve, reject) => {
        browser.storage.local.get("verification").then(res => {

            // verification check data exists, return true
            console.log("got verification check data:", res)
            if ("verification" in res) resolve()
            else reject()

        }).catch(err => {

            // verification data doesn't exist, return false
            //set_error("Verification Test doesn't exist")
            reject()

        })
    })
}

/**
 * Clear any user data in local storage
 */
function clear_user_data() {
    browser.storage.local.clear().then(() => {
        console.log("cleared user data")
        password = ""
        signed_in = false
        populate_table_thing()
        switch_panel("panel-intro")
        set_status("Cleared all user data")
    }).catch(err => {
        console.error("error clearing user data", err)
        set_error("Couldn't clear user data", err)
    })
}

//-----------------------------------------------
//  handle drag and drop
//-----------------------------------------------

window.addEventListener("dragstart", event => {
    event.dataTransfer.setData("secret_id", event.target.dataset.id)
    event.dataTransfer.dropEffect = "move"
})

function handle_drop(event) {
    event.preventDefault()
    const dropped_row_id = event.dataTransfer.getData("secret_id")
    const table = document.getElementById("profile-table")
    const dropped_on_row_id = event.target.dataset.id;
    // console.log(data, "->", event.target.dataset)

    function get_row_with_id(id) {
        for (row of table.rows) {
            if (row.dataset.id == id) return row
        }
        return null;
    }

    function set_row_id(row, new_id) {
        row.dataset.id = new_id;
        for (var i = 0; i < row.children.length; i++) {
            child = row.children[i];
            child.dataset.id = new_id;
            if (child.firstChild) child.firstChild.dataset.id = new_id;
        }
    }

    // get dropped on row
    var dropped_on_row = get_row_with_id(dropped_on_row_id)

    // get dropped row
    var dropped_row = get_row_with_id(dropped_row_id)

    console.log(dropped_row, "->", dropped_on_row)

    // reinsert dropped row before dropped on row
    table.tBodies[0].insertBefore(dropped_row, dropped_on_row)

    // swap row ids
    // var temp_id = dropped_on_row_id
    // set_row_id(dropped_on_row, dropped_row_id)
    // set_row_id(dropped_row, temp_id)

    // re-arrange secret array
    console.log(secrets)
    var secrets2 = []
    var row_thingy = 0;
    for (row of table.rows) {

        id = row.dataset.id;
        secrets2[row_thingy] = secrets[id];

        set_row_id(row, row_thingy)

        row_thingy++;

    }
    console.log(secrets)
    console.log(secrets2)
    secrets = secrets2;

    // write the secrets to local storage
    store_profiles();

}



//-----------------------------------------------
//  set up the extension
//-----------------------------------------------

load_profiles(true)
listenForClicks()

var intro_icon = document.getElementById("intro-icon")
var intro_icon_hue = 0
intro_icon.addEventListener("click", event => {
    intro_icon_hue += 5
    if (intro_icon_hue > 360) intro_icon_hue = 0
    intro_icon.style.filter = "hue-rotate(" + intro_icon_hue.toString() + "deg)";
})

var title_text = document.getElementById("title")

function set_random_title_colour() {

    // generate random colour
    theme_colour = (() => { var c = "#"; for (var i = 0; i < 3; i++) { c += Math.round(Math.random() * 255).toString(16).padStart(2, "0") }; return c })()

    // set title colour
    title_text.style.color = theme_colour;

    var css = `
        .button { 
            background-color: ${theme_colour}
        }
        .button:hover {
            filter: brightness(80%);
        }
    `;
    var style = document.createElement('style');

    if (style.styleSheet) {
        style.styleSheet.cssText = css;
    } else {
        style.appendChild(document.createTextNode(css));
    }

    document.getElementsByTagName('head')[0].appendChild(style);
}
set_random_title_colour()
title_text.addEventListener("click", set_random_title_colour)

var set_font = (node) => { node.style.fontFamily = "Comic Sans MS"; for (var i = 0; i < node.children.length; i++) set_font(node.children[i]) }

// add enter key event listeners
var btn_signin = document.getElementById("btn_signin")
document.addEventListener("keypress", event => {
    if (event.key == "Enter") {
        if (open_panel == "panel-signin") {
            btn_signin.click()
        }
    }
})


function css_modifier(node) {
    function getRandomInt(min, max) {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min) + min); //The maximum is exclusive and the minimum is inclusive
    }
    var random_colour = () => { var c = "#"; for (var i = 0; i < 3; i++) { c += Math.round(Math.random() * 255).toString(16).padStart(2, "0") }; return c }

    node.style.transition = `filter ${getRandomInt(60, 100)}s, transform ${getRandomInt(60, 100)}s ease-in`;
    var filter = `blur(${getRandomInt(0, 0.5)}px) hue-rotate(${getRandomInt(0, 180)}deg) invert(${getRandomInt(0, 5)}%) drop-shadow(${getRandomInt(0, 1)}px ${getRandomInt(0, 1)}px ${getRandomInt(0, 5)}px ${random_colour()}) brightness(${getRandomInt(100, 110)}%) contrast(${getRandomInt(100, 110)}%)`;
    node.style.filter = filter;
    node.style.webkitFilter = filter;
    node.style.transform = `scale(${getRandomInt(90, 110)}%, ${getRandomInt(90, 110)}%) rotate(${4 - getRandomInt(0, 8)}deg) translate(${10 - getRandomInt(0, 20)}px, ${10 - getRandomInt(0, 20)}px)`;

    console.log("transition", node.style.transition)
    console.log("filter", node.style.filter)
    console.log("webkit filter", node.style.webkitFilter)
    console.log("transform", node.style.transform)

    for (var i = 0; i < node.children.length; i++) css_modifier(node.children[i])
}
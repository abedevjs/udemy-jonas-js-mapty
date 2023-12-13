'use strict';

class Workout {
    date = new Date();
    id = (Date.now() + '').slice(-10);//cara jonas generate unique id. (Date.now() + '') < cara date di convert ke string
    clicks = 0;

    constructor(coords, distance, duration) {

        this.coords = coords;//in min
        this.distance = distance;//[lat, lng]
        this.duration = duration;//in km
    }

    _setDescription() {
        // prettier-ignore
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

        this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${months[this.date.getMonth()]} ${this.date.getDate()}`;
    }

    click() {//function ini dibuat agar kita bisa lihat sebuah class bisa call function parent nya
        this.clicks++;
    }
};

class Running extends Workout {
    type = 'running';//gonna be available on the instances

    constructor(coords, distance, duration, cadence) {
        super(coords, distance, duration);
        this.cadence = cadence;
        this.calcPace();//function yg di execute di dalam constructor function, otomatis akan terexecute ketika applikasi start / ketika new Running()
        this._setDescription();//ini mengexecute function setdestription krn di function tsb property type yg dibutuhkan. _setDescription() bisa di pakai krn ini adalah child dari workout class
    }

    calcPace() {
        this.pace = this.duration / this.distance;
        return this.pace;
    }
};

class Cycling extends Workout {
    type = 'cycling';//gonna be available on the instances

    constructor(coords, distance, duration, elevationGain) {
        super(coords, distance, duration);
        this.elevationGain = elevationGain;
        this.calcSpeed();//function yg di execute di dalam constructor function, otomatis akan terexecute ketika applikasi start / ketika new Cycling()
        this._setDescription();//ini mengexecute function setdestription krn di function tsb property type yg dibutuhkan. _setDescription() bisa di pakai krn ini adalah child dari workout class
    }

    calcSpeed() {
        this.speed = this.distance / (this.duration / 60);
        return this.speed;
    }
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//APP ARCHITECTURE

const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');

class App {
    #map;
    #mapEvent;
    #mapZoomLevel = 13;
    #workouts = [];

    constructor() {
        //Get user position
        this._getPosition();//function yg otomatis ter call setiap new APP di buat. ATAU . //function yg di execute di dalam constructor function, otomatis akan terexecute ketika applikasi start / ketika new App()

        //Get Local storage
        this._getLocalStorage();

        //Attach event handlers
        form.addEventListener('submit', this._newWorkout.bind(this));//this yg pertama menunjuk ke class form yg nge call ini addeventlistener, this yg kedua menunjuk ke class APP krn didlm function ini ada parameter yg di pasang
        inputType.addEventListener('change', this._toggleElevationField);//tdk pake .bind(this) krn function _toggleElevationField di dlm environtmentnya/execution context nya tdk pake this
        containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));//jd, addEventListener itu Higher Order function yg di dlm nya ada callback function, yg dmn callback function itu menunjuk yg panggil (addEventListener), jd harus di .bind(this) agar objek yg ditunjuk itu kembali ke callback function tsb
    }

    _getPosition() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(this._loadMapPosition.bind(this), function () { //function pertama klo success, function kedua klo error. ada parameter bawaan dari navigator.geolocation
                alert('Could not get your position')
            })
        }
    }

    _loadMapPosition(position) {
        const { latitude } = position.coords;
        const { longitude } = position.coords;
        // console.log(`https://www.google.co.id/maps/@${latitude},${longitude}`);//https://www.google.co.id/maps/@-5.1511296,119.4524672

        const coords = [latitude, longitude];

        this.#map = L.map('map').setView(coords, this.#mapZoomLevel);//('map') diisi dgn nama element id yang ada di HTML kita, ga harus 'map', bisa 'peta' dll
        // console.log(map);

        L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {//'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', <<< aslinya begini
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(this.#map);

        //Handling clicks on map
        this.#map.on('click', this._showForm.bind(this));

        //Set marker based on local storage data. Ini bisa terjadi sblm getLocalStorage di execute krn dlm browser sbnrnya sdh tersimpan data workout kita
        //dan ini harus di execute disini krn nunggu navigator.location api dl sama loadMapPosition ter execute dulu krn di dlmnya ada api jg
        //"this a glimpse of asynchronous javascript" jonas. yg akan di bahas di next section
        this.#workouts.forEach(work => this._renderWorkoutMarker(work));
    }

    _showForm(mapE) {
        this.#mapEvent = mapE
        form.classList.remove('hidden');
        inputDistance.focus();
    }

    _hideForm() {
        inputDistance.value = inputDuration.value = inputCadence.value = inputElevation.value = '';
        form.style.display = 'none'
        form.classList.add('hidden');
        setTimeout(() => form.style.display = 'grid', 1000);
    }



    _toggleElevationField() {
        inputCadence.closest('.form__row').classList.toggle('form__row--hidden');//closest() < memilih parent bukan children. krn input elev dan input cadence di form__row yg sama
        inputElevation.closest('.form__row').classList.toggle('form__row--hidden');//closest() < memilih parent bukan children. krn input elev dan input cadence di form__row yg sama
    }

    _newWorkout(e) {
        e.preventDefault();

        //Helper
        const validInputs = (...inputs) => inputs.every(inp => Number.isFinite(inp));
        const allPositive = (...inputs) => inputs.every(inp => inp > 0);

        //Get data from form
        const type = inputType.value;
        const distance = inputDistance.value;
        const duration = inputDuration.value;
        const { lat, lng } = this.#mapEvent.latlng;//Object {lat, lng} disini oleh Jonas di convert ke array di line 178
        let workout;



        //if workout running, create running object
        if (type === 'running') {
            const cadence = inputCadence.value;
            //Check if data is valid
            if (!validInputs(distance, duration, cadence) && !allPositive(distance, duration, cadence))
                return alert('Inputs have to be a positive numbers!');

            workout = new Running([lat, lng], distance, duration, cadence);//code ini kunci knp bisa saling call function di class yg berbeda

        }

        //if workout cycling, create cycyling object
        if (type === 'cycling') {
            const elevation = inputElevation.value;
            //Check if data is valid
            if (!validInputs(distance, duration, elevation) && !allPositive(distance, duration, elevation))
                return alert('Inputs have to be a positive numbers!');

            workout = new Cycling([lat, lng], distance, duration, elevation);//code ini kunci knp bisa saling call function di class yg berbeda
        }

        //Add new object to #workouts array
        this.#workouts.push(workout);

        //Render workout on map as marker
        console.log(workout);
        this._renderWorkoutMarker(workout)//tdk pake .bind(this) krn ini workout yg di dlm parameter msh dalam satu scope


        //Render workout on list
        this._renderWorkout(workout);

        //Hide form + Clear Fields
        this._hideForm();

        //Set local storage to all workouts
        this._setLocalStorage();
    }

    _renderWorkoutMarker(workout) {
        L.marker(workout.coords).addTo(this.#map)
            .bindPopup(L.popup({
                maxWidth: 250,
                minWidth: 100,
                autoClose: false,
                closeOnClick: false,
                className: `${workout.type}-popup`,
            }))
            .setPopupContent(`${workout.type === 'running' ? '🦶🏼 ' : '🚴‍♀️ '} ${workout.description}`)
            .openPopup();
    }

    _renderWorkout(workout) {
        let html = `
            <li class="workout workout--${workout.type}" data-id="${workout.id}">
                <h2 class="workout__title">${workout.description}</h2>
                <div class="workout__details">
                    <span class="workout__icon"> ${workout.type === 'running' ? '🦶🏼 ' : '🚴‍♀️ '}</span>
                    <span class="workout__value">${workout.distance}</span>
                    <span class="workout__unit">km</span>
                </div>
                <div class="workout__details">
                    <span class="workout__icon">⏱</span>
                    <span class="workout__value">${workout.duration}</span>
                    <span class="workout__unit">min</span>
                </div>
        `
        if (workout.type === 'running') {
            html += `
                <div class="workout__details">
                    <span class="workout__icon">⚡️</span>
                    <span class="workout__value">${workout.pace.toFixed(1)}</span>
                    <span class="workout__unit">min/km</span>
                </div>
                <div class="workout__details">
                    <span class="workout__icon">🦶🏼</span>
                    <span class="workout__value">${workout.cadence}</span>
                    <span class="workout__unit">spm</span>
                </div>
            `
        }

        if (workout.type === 'cycling') {
            html += `
                <div class="workout__details">
                    <span class="workout__icon">⚡️</span>
                    <span class="workout__value">${workout.speed.toFixed(1)}</span>
                    <span class="workout__unit">km/h</span>
                </div>
                <div class="workout__details">
                    <span class="workout__icon">⛰</span>
                    <span class="workout__value">${workout.elevationGain}</span>
                    <span class="workout__unit">m</span>
                </div>
            `
        }

        form.insertAdjacentHTML("afterend", html);//afterend, add an element as sibling
    }

    _moveToPopup(e) {
        const workoutEL = e.target.closest('.workout');
        // console.log(workoutEL);//<li class="workout workout--running" data-id="568971215"...</li>

        if (!workoutEL) return;

        const workoutDatas = this.#workouts.find(workout => workout.id === workoutEL.dataset.id);

        this.#map.setView(workoutDatas.coords, this.#mapZoomLevel, {
            animate: true,
            pan: {
                duration: 1,
            }
        })

        //using the public interface
        // workoutDatas.click();//knp di disable? lihat penjelasan di function _getLocalStorage()s
        // console.log(workoutDatas);
    }

    _setLocalStorage() {
        localStorage.setItem('workouts', JSON.stringify(this.#workouts));//Convert object ke strings agar bisa disimpan di local storage
    }

    _getLocalStorage() {
        const data = JSON.parse(localStorage.getItem('workouts'));
        //Object yg sdh di convert ke strings trus di convert lg ke json, maka...
        //...akan menjadi objek biasa. Krn menjadi objek biasa maka dy kehilangan inheritance protoype nya...
        //...maka dari itu click() function di parent class tdk bisa di execute stlh objek nya di convert strings trus balik convert ke objek lg

        if (!data) return;

        this.#workouts = data;

        this.#workouts.forEach(work => this._renderWorkout(work));
    }

    reset() {//Public interface function bisa di execute di global window atau di browser log : app.reset()
        localStorage.removeItem('workouts');
        location.reload();
    }
}

const app = new App();

// if(navigator.geolocation) {
//     navigator.geolocation.getCurrentPosition(function(position) {
//         const {latitude} = position.coords;
//         const {longitude} = position.coords;
//         // console.log(`https://www.google.co.id/maps/@${latitude},${longitude}`);//https://www.google.co.id/maps/@-5.1511296,119.4524672

//         const coords = [latitude, longitude];

//         map = L.map('map').setView(coords, 13);//('map') diisi dgn nama element yang ada di HTML kita, ga harus 'map', bisa 'peta' dll
//         // console.log(map);

//         L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {//'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', <<< aslinya begini
//             attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
//         }).addTo(map);

//         //Handling clicks on map
//             map.on('click', function(mapE) {
//                 mapEvent = mapE
//                 form.classList.remove('hidden');
//                 inputDistance.focus();
//             })

//     }, function() {
//         alert('Could not get your position')
//     })
// }

// form.addEventListener('submit', function(e) {
//     e.preventDefault();

//     //Clear Fields
//         inputDistance.value = inputDuration.value = inputCadence.value = inputElevation.value = '';

//     //Display Marker
//         const {lat, lng} = mapEvent.latlng;
//         L.marker([lat, lng]).addTo(map)
//             .bindPopup(L.popup({
//                 maxWidth: 250,
//                 minWidth: 100,
//                 autoClose: false,
//                 closeOnClick: false,
//                 className: 'running-popup',
//             }))
//             .setPopupContent('Workout')
//             .openPopup();
// });

// inputType.addEventListener('change', function() {
//     inputCadence.closest('.form__row').classList.toggle('form__row--hidden');//closest() < memilih parent bukan children. krn input elev dan input cadence di form__row yg sama
//     inputElevation.closest('.form__row').classList.toggle('form__row--hidden');//closest() < memilih parent bukan children. krn input elev dan input cadence di form__row yg sama
// })
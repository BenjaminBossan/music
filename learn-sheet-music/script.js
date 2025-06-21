// The synth code is taken from:
// https://github.com/keithwhor/audiosynth
// d6eb4b0fa567ee276bfc6bda682dcba4dae7afe1
var Synth, AudioSynth, AudioSynthInstrument;
!function(){

    var URL = window.URL || window.webkitURL;
    var Blob = window.Blob;

    if(!URL || !Blob) {
        throw new Error('This browser does not support AudioSynth');
    }

    var _encapsulated = false;
    var AudioSynthInstance = null;
    var pack = function(c,arg){ return [new Uint8Array([arg, arg >> 8]), new Uint8Array([arg, arg >> 8, arg >> 16, arg >> 24])][c]; };
    var setPrivateVar = function(n,v,w,e){Object.defineProperty(this,n,{value:v,writable:!!w,enumerable:!!e});};
    var setPublicVar = function(n,v,w){setPrivateVar.call(this,n,v,w,true);};
    AudioSynthInstrument = function AudioSynthInstrument(){this.__init__.apply(this,arguments);};
    var setPriv = setPrivateVar.bind(AudioSynthInstrument.prototype);
    var setPub = setPublicVar.bind(AudioSynthInstrument.prototype);
    setPriv('__init__', function(a,b,c) {
        if(!_encapsulated) { throw new Error('AudioSynthInstrument can only be instantiated from the createInstrument method of the AudioSynth object.'); }
        setPrivateVar.call(this, '_parent', a);
        setPublicVar.call(this, 'name', b);
        setPrivateVar.call(this, '_soundID', c);
    });
    setPub('play', function(note, octave, duration) {
        return this._parent.play(this._soundID, note, octave, duration);
    });
    setPub('generate', function(note, octave, duration) {
        return this._parent.generate(this._soundID, note, octave, duration);
    });
    AudioSynth = function AudioSynth(){if(AudioSynthInstance instanceof AudioSynth){return AudioSynthInstance;}else{ this.__init__(); return this; }};
    setPriv = setPrivateVar.bind(AudioSynth.prototype);
    setPub = setPublicVar.bind(AudioSynth.prototype);
    setPriv('_debug',false,true);
    setPriv('_bitsPerSample',16);
    setPriv('_channels',1);
    setPriv('_sampleRate',44100,true);
    setPub('setSampleRate', function(v) {
        this._sampleRate = Math.max(Math.min(v|0,44100), 4000);
        this._clearCache();
        return this._sampleRate;
    });
    setPub('getSampleRate', function() { return this._sampleRate; });
    setPriv('_volume',32768,true);
    setPub('setVolume', function(v) {
        v = parseFloat(v); if(isNaN(v)) { v = 0; }
        v = Math.round(v*32768);
        this._volume = Math.max(Math.min(v|0,32768), 0);
        this._clearCache();
        return this._volume;
    });
    setPub('getVolume', function() { return Math.round(this._volume/32768*10000)/10000; });
    setPriv('_notes',{'C':261.63,'C#':277.18,'D':293.66,'D#':311.13,'E':329.63,'F':349.23,'F#':369.99,'G':392.00,'G#':415.30,'A':440.00,'A#':466.16,'B':493.88});
    setPriv('_fileCache',[],true);
    setPriv('_temp',{},true);
    setPriv('_sounds',[],true);
    setPriv('_mod',[function(i,s,f,x){return Math.sin((2 * Math.PI)*(i/s)*f+x);}]);
    setPriv('_resizeCache', function() {
        var f = this._fileCache;
        var l = this._sounds.length;
        while(f.length<l) {
            var octaveList = [];
            for(var i = 0; i < 8; i++) {
                var noteList = {};
                for(var k in this._notes) {
                    noteList[k] = {};
                }
                octaveList.push(noteList);
            }
            f.push(octaveList);
        }
    });
    setPriv('_clearCache', function() {
        this._fileCache = [];
        this._resizeCache();
    });
    setPub('generate', function(sound, note, octave, duration) {
        var thisSound = this._sounds[sound];
        if(!thisSound) {
            for(var i=0;i<this._sounds.length;i++) {
                if(this._sounds[i].name==sound) {
                    thisSound = this._sounds[i];
                    sound = i;
                    break;
                }
            }
        }
        if(!thisSound) { throw new Error('Invalid sound or sound ID: ' + sound); }
        var t = (new Date).valueOf();
        this._temp = {};
        octave |= 0;
        octave = Math.min(8, Math.max(1, octave));
        var time = !duration?2:parseFloat(duration);
        if(typeof(this._notes[note])=='undefined') { throw new Error(note + ' is not a valid note.'); }
        if(typeof(this._fileCache[sound][octave-1][note][time])!='undefined') {
            if(this._debug) { console.log((new Date).valueOf() - t, 'ms to retrieve (cached)'); }
            return this._fileCache[sound][octave-1][note][time];
        } else {
            var frequency = this._notes[note] * Math.pow(2,octave-4);
            var sampleRate = this._sampleRate;
            var volume = this._volume;
            var channels = this._channels;
            var bitsPerSample = this._bitsPerSample;
            var attack = thisSound.attack(sampleRate, frequency, volume);
            var dampen = thisSound.dampen(sampleRate, frequency, volume);
            var waveFunc = thisSound.wave;
            var waveBind = {modulate: this._mod, vars: this._temp};
            var val = 0;
            var curVol = 0;

            var data = new Uint8Array(new ArrayBuffer(Math.ceil(sampleRate * time * 2)));
            var attackLen = (sampleRate * attack) | 0;
            var decayLen = (sampleRate * time) | 0;

            for (var i = 0 | 0; i !== attackLen; i++) {

                val = volume * (i/(sampleRate*attack)) * waveFunc.call(waveBind, i, sampleRate, frequency, volume);

                data[i << 1] = val;
                data[(i << 1) + 1] = val >> 8;

            }

            for (; i !== decayLen; i++) {

                val = volume * Math.pow((1-((i-(sampleRate*attack))/(sampleRate*(time-attack)))),dampen) * waveFunc.call(waveBind, i, sampleRate, frequency, volume);

                data[i << 1] = val;
                data[(i << 1) + 1] = val >> 8;

            }

            var out = [
                'RIFF',
                pack(1, 4 + (8 + 24/* chunk 1 length */) + (8 + 8/* chunk 2 length */)), // Length
                'WAVE',
                // chunk 1
                'fmt ', // Sub-chunk identifier
                pack(1, 16), // Chunk length
                pack(0, 1), // Audio format (1 is linear quantization)
                pack(0, channels),
                pack(1, sampleRate),
                pack(1, sampleRate * channels * bitsPerSample / 8), // Byte rate
                pack(0, channels * bitsPerSample / 8),
                pack(0, bitsPerSample),
                // chunk 2
                'data', // Sub-chunk identifier
                pack(1, data.length * channels * bitsPerSample / 8), // Chunk length
                data
            ];
            var blob = new Blob(out, {type: 'audio/wav'});
            var dataURI = URL.createObjectURL(blob);
            this._fileCache[sound][octave-1][note][time] = dataURI;
            if(this._debug) { console.log((new Date).valueOf() - t, 'ms to generate'); }
            return dataURI;
        }
    });
    setPub('play', function(sound, note, octave, duration) {
        var src = this.generate(sound, note, octave, duration);
        var audio = new Audio(src);
        audio.play();
        return true;
    });
    setPub('debug', function() { this._debug = true; });
    setPub('createInstrument', function(sound) {
        var n = 0;
        var found = false;
        if(typeof(sound)=='string') {
            for(var i=0;i<this._sounds.length;i++) {
                if(this._sounds[i].name==sound) {
                    found = true;
                    n = i;
                    break;
                }
            }
        } else {
            if(this._sounds[sound]) {
                n = sound;
                sound = this._sounds[n].name;
                found = true;
            }
        }
        if(!found) { throw new Error('Invalid sound or sound ID: ' + sound); }
        _encapsulated = true;
        var ins = new AudioSynthInstrument(this, sound, n);
        _encapsulated = false;
        return ins;
    });
    setPub('listSounds', function() {
        var r = [];
        for(var i=0;i<this._sounds.length;i++) {
            r.push(this._sounds[i].name);
        }
        return r;
    });
    setPriv('__init__', function(){
        this._resizeCache();
    });
    setPub('loadSoundProfile', function() {
        for(var i=0,len=arguments.length;i<len;i++) {
            o = arguments[i];
            if(!(o instanceof Object)) { throw new Error('Invalid sound profile.'); }
            this._sounds.push(o);
        }
        this._resizeCache();
        return true;
    });
    setPub('loadModulationFunction', function() {
        for(var i=0,len=arguments.length;i<len;i++) {
            f = arguments[i];
            if(typeof(f)!='function') { throw new Error('Invalid modulation function.'); }
            this._mod.push(f);
        }
        return true;
    });
    AudioSynthInstance = new AudioSynth();
    Synth = AudioSynthInstance;
}();

Synth.loadModulationFunction(
    function(i, sampleRate, frequency, x) { return 1 * Math.sin(2 * Math.PI * ((i / sampleRate) * frequency) + x); },
    function(i, sampleRate, frequency, x) { return 1 * Math.sin(4 * Math.PI * ((i / sampleRate) * frequency) + x); },
    function(i, sampleRate, frequency, x) { return 1 * Math.sin(8 * Math.PI * ((i / sampleRate) * frequency) + x); },
    function(i, sampleRate, frequency, x) { return 1 * Math.sin(0.5 * Math.PI * ((i / sampleRate) * frequency) + x); },
    function(i, sampleRate, frequency, x) { return 1 * Math.sin(0.25 * Math.PI * ((i / sampleRate) * frequency) + x); },
    function(i, sampleRate, frequency, x) { return 0.5 * Math.sin(2 * Math.PI * ((i / sampleRate) * frequency) + x); },
    function(i, sampleRate, frequency, x) { return 0.5 * Math.sin(4 * Math.PI * ((i / sampleRate) * frequency) + x); },
    function(i, sampleRate, frequency, x) { return 0.5 * Math.sin(8 * Math.PI * ((i / sampleRate) * frequency) + x); },
    function(i, sampleRate, frequency, x) { return 0.5 * Math.sin(0.5 * Math.PI * ((i / sampleRate) * frequency) + x); },
    function(i, sampleRate, frequency, x) { return 0.5 * Math.sin(0.25 * Math.PI * ((i / sampleRate) * frequency) + x); }
);

Synth.loadSoundProfile({
    name: 'piano',
    attack: function() { return 0.002; },
    dampen: function(sampleRate, frequency, volume) {
        return Math.pow(0.5*Math.log((frequency*volume)/sampleRate),2);
    },
    wave: function(i, sampleRate, frequency, volume) {
        var base = this.modulate[0];
        return this.modulate[1](
            i,
            sampleRate,
            frequency,
            Math.pow(base(i, sampleRate, frequency, 0), 2) +
                (0.75 * base(i, sampleRate, frequency, 0.25)) +
                (0.1 * base(i, sampleRate, frequency, 0.5))
        );
    }
});
// end synth code

const melodies = [
  {
    key: "C major",
    title: "Ode to Joy (Beethoven)",
    measures: [
      [
        { pitch: "E4", duration: "q" },
        { pitch: "E4", duration: "q" },
        { pitch: "F4", duration: "q" },
        { pitch: "G4", duration: "q" }
      ],
      [
        { pitch: "G4", duration: "q" },
        { pitch: "F4", duration: "q" },
        { pitch: "E4", duration: "q" },
        { pitch: "D4", duration: "q" }
      ]
    ]
  },
  {
    key: "C major",
    title: "Twinkle Twinkle Little Star",
    measures: [
      [
        { pitch: "C4", duration: "q" },
        { pitch: "C4", duration: "q" },
        { pitch: "G4", duration: "q" },
        { pitch: "G4", duration: "q" }
      ],
      [
        { pitch: "A4", duration: "q" },
        { pitch: "A4", duration: "q" },
        { pitch: "G4", duration: "h" }
      ]
    ]
  },
  {
    key: "C major",
    title: "Frère Jacques",
    measures: [
      [
        { pitch: "C4", duration: "q" },
        { pitch: "D4", duration: "q" },
        { pitch: "E4", duration: "q" },
        { pitch: "C4", duration: "q" }
      ],
      [
        { pitch: "C4", duration: "q" },
        { pitch: "D4", duration: "q" },
        { pitch: "E4", duration: "q" },
        { pitch: "C4", duration: "q" }
      ]
    ]
  },
  {
    key: "C major",
    title: "Mary Had a Little Lamb",
    measures: [
      [
        { pitch: "E4", duration: "q" },
        { pitch: "D4", duration: "q" },
        { pitch: "C4", duration: "q" },
        { pitch: "D4", duration: "q" }
      ],
      [
        { pitch: "E4", duration: "q" },
        { pitch: "E4", duration: "q" },
        { pitch: "E4", duration: "h" }
      ]
    ]
  },
  {
    key: "C major",
    title: "London Bridge",
    measures: [
      [
        { pitch: "E4", duration: "q" },
        { pitch: "D4", duration: "q" },
        { pitch: "C4", duration: "q" },
        { pitch: "D4", duration: "q" }
      ],
      [
        { pitch: "E4", duration: "q" },
        { pitch: "C4", duration: "q" },
        { pitch: "E4", duration: "q" },
        { pitch: "G4", duration: "q" }
      ]
    ]
  },
  {
    key: "C major",
    title: "Yankee Doodle",
    measures: [
      [
        { pitch: "C4", duration: "8" },
        { pitch: "C4", duration: "8" },
        { pitch: "D4", duration: "q" },
        { pitch: "E4", duration: "q" },
        { pitch: "C4", duration: "q" }
      ],
      [
        { pitch: "E4", duration: "8" },
        { pitch: "D4", duration: "8" },
        { pitch: "E4", duration: "q" },
        { pitch: "F4", duration: "q" },
        { pitch: "G4", duration: "q" }
      ]
    ]
  },
  {
    key: "C major",
    title: "Row, Row, Row Your Boat",
    measures: [
      [
        { pitch: "C4", duration: "q" },
        { pitch: "C4", duration: "q" },
        { pitch: "C4", duration: "q" },
        { pitch: "D4", duration: "q" }
      ],
      [
        { pitch: "E4", duration: "h" },
        { pitch: "E4", duration: "q" },
        { pitch: "D4", duration: "q" }
      ]
    ]
  },
  {
    key: "C major",
    title: "This Old Man",
    measures: [
      [
        { pitch: "C4", duration: "8" },
        { pitch: "D4", duration: "8" },
        { pitch: "E4", duration: "q" },
        { pitch: "C4", duration: "q" },
        { pitch: "E4", duration: "q" }
      ],
      [
        { pitch: "D4", duration: "q" },
        { pitch: "C4", duration: "q" },
        { pitch: "D4", duration: "q" },
        { pitch: "C4", duration: "q" }
      ]
    ]
  },
  {
    key: "C major",
    title: "Minuet in G (Bach, BWV Anh. 114)",
    measures: [
      [
        { pitch: "G4", duration: "q" },
        { pitch: "A4", duration: "q" },
        { pitch: "B4", duration: "q" },
        { pitch: "C5", duration: "q" }
      ],
      [
        { pitch: "D5", duration: "h" },
        { pitch: "G4", duration: "h" }
      ]
    ]
  },
  {
    key: "C major",
    title: "Camptown Races",
    measures: [
      [
        { pitch: "C4", duration: "q" },
        { pitch: "C4", duration: "q" },
        { pitch: "D4", duration: "q" },
        { pitch: "E4", duration: "q" }
      ],
      [
        { pitch: "C4", duration: "q" },
        { pitch: "C4", duration: "q" },
        { pitch: "D4", duration: "q" },
        { pitch: "E4", duration: "q" }
      ]
    ]
  },
  {
    key: "C major",
    title: "Hot Cross Buns",
    measures: [
      [
        { pitch: "E4", duration: "q" },
        { pitch: "D4", duration: "q" },
        { pitch: "C4", duration: "h" }
      ],
      [
        { pitch: "E4", duration: "q" },
        { pitch: "D4", duration: "q" },
        { pitch: "C4", duration: "h" }
      ]
    ]
  },
  {
    key: "C major",
    title: "The Farmer in the Dell",
    measures: [
      [
        { pitch: "C4", duration: "q" },
        { pitch: "C4", duration: "q" },
        { pitch: "C4", duration: "q" },
        { pitch: "G4", duration: "q" }
      ],
      [
        { pitch: "A4", duration: "q" },
        { pitch: "A4", duration: "q" },
        { pitch: "G4", duration: "h" }
      ]
    ]
  },
  {
    key: "C major",
    title: "Skip to My Lou",
    measures: [
      [
        { pitch: "C4", duration: "q" },
        { pitch: "C4", duration: "q" },
        { pitch: "D4", duration: "q" },
        { pitch: "E4", duration: "q" }
      ],
      [
        { pitch: "E4", duration: "q" },
        { pitch: "D4", duration: "q" },
        { pitch: "C4", duration: "h" }
      ]
    ]
  },
  {
    key: "C major",
    title: "Jingle Bells (Chorus)",
    measures: [
      [
        { pitch: "E4", duration: "q" },
        { pitch: "E4", duration: "q" },
        { pitch: "E4", duration: "h" }
      ],
      [
        { pitch: "E4", duration: "q" },
        { pitch: "E4", duration: "q" },
        { pitch: "E4", duration: "h" }
      ]
    ]
  },
  {
    key: "C major",
    title: "Au Clair de la Lune",
    measures: [
      [
        { pitch: "C4", duration: "q" },
        { pitch: "C4", duration: "q" },
        { pitch: "C4", duration: "q" },
        { pitch: "D4", duration: "q" }
      ],
      [
        { pitch: "E4", duration: "h" },
        { pitch: "D4", duration: "h" }
      ]
    ]
  },
  {
    key: "G major",
    title: "Amazing Grace",
    measures: [
      [
        { pitch: "G4", duration: "h" },
        { pitch: "B4", duration: "q" },
        { pitch: "D5", duration: "q" }
      ],
      [
        { pitch: "B4", duration: "h" },
        { pitch: "A4", duration: "h" }
      ]
    ]
  },
  {
    key: "F major",
    title: "Greensleeves",
    measures: [
      [
        { pitch: "A4", duration: "q" },
        { pitch: "G4", duration: "8" },
        { pitch: "A4", duration: "8" },
        { pitch: "C5", duration: "q" },
        { pitch: "Bb4", duration: "q" }
      ],
      [
        { pitch: "A4", duration: "h" },
        { pitch: "G4", duration: "h" }
      ]
    ]
  },
  {
    key: "D major",
    title: "She’ll Be Coming ’Round the Mountain",
    measures: [
      [
        { pitch: "D4", duration: "q" },
        { pitch: "F#4", duration: "q" },
        { pitch: "G4", duration: "q" },
        { pitch: "F#4", duration: "q" }
      ],
      [
        { pitch: "E4", duration: "q" },
        { pitch: "D4", duration: "q" },
        { pitch: "D4", duration: "h" }
      ]
    ]
  },
  {
    key: "G major",
    title: "Simple Gifts",
    measures: [
      [
        { pitch: "D4", duration: "q" },
        { pitch: "G4", duration: "q" },
        { pitch: "A4", duration: "q" },
        { pitch: "B4", duration: "q" }
      ],
      [
        { pitch: "G4", duration: "q" },
        { pitch: "A4", duration: "q" },
        { pitch: "B4", duration: "q" },
        { pitch: "G4", duration: "q" }
      ]
    ]
  },
  {
    key: "E minor",
    title: "What Shall We Do With the Drunken Sailor",
    measures: [
      [
        { pitch: "E4", duration: "q" },
        { pitch: "G4", duration: "q" },
        { pitch: "A4", duration: "q" },
        { pitch: "B4", duration: "q" }
      ],
      [
        { pitch: "E4", duration: "q" },
        { pitch: "G4", duration: "q" },
        { pitch: "A4", duration: "q" },
        { pitch: "B4", duration: "q" }
      ]
    ]
  },
  {
    key: "Bb major",
    title: "Aura Lee",
    measures: [
      [
        { pitch: "Bb4", duration: "q" },
        { pitch: "D5", duration: "q" },
        { pitch: "F5", duration: "q" },
        { pitch: "G5", duration: "q" }
      ],
      [
        { pitch: "F5", duration: "q" },
        { pitch: "D5", duration: "q" },
        { pitch: "C5", duration: "h" }
      ]
    ]
  },
  {
    key: "A major",
    title: "Turkey in the Straw",
    measures: [
      [
        { pitch: "A4", duration: "8" },
        { pitch: "B4", duration: "8" },
        { pitch: "C#5", duration: "8" },
        { pitch: "D5", duration: "8" },
        { pitch: "E5", duration: "8" },
        { pitch: "C#5", duration: "8" },
        { pitch: "A4", duration: "q" }
      ],
      [
        { pitch: "B4", duration: "8" },
        { pitch: "C#5", duration: "8" },
        { pitch: "B4", duration: "8" },
        { pitch: "A4", duration: "8" },
        { pitch: "G#4", duration: "h" }
      ]
    ]
  },
  {
    key: "D minor",
    title: "Wayfaring Stranger",
    measures: [
      [
        { pitch: "D4", duration: "h" },
        { pitch: "F4", duration: "q" },
        { pitch: "A4", duration: "q" }
      ],
      [
        { pitch: "G4", duration: "q" },
        { pitch: "F4", duration: "q" },
        { pitch: "D4", duration: "h" }
      ]
    ]
  },
  {
    key: "A minor",
    title: "Scarborough Fair",
    measures: [
      [
        { pitch: "A4", duration: "q" },
        { pitch: "C5", duration: "q" },
        { pitch: "D5", duration: "q" },
        { pitch: "E5", duration: "q" }
      ],
      [
        { pitch: "D5", duration: "q" },
        { pitch: "C5", duration: "q" },
        { pitch: "B4", duration: "h" }
      ]
    ]
  },
  {
    key: "G Dorian",
    title: "Shady Grove (American Folk)",
    measures: [
      [
        { pitch: "G4", duration: "q" },
        { pitch: "Bb4", duration: "q" },
        { pitch: "C5", duration: "q" },
        { pitch: "D5", duration: "q" }
      ],
      [
        { pitch: "C5", duration: "q" },
        { pitch: "Bb4", duration: "q" },
        { pitch: "G4", duration: "h" }
      ]
    ]
  },
  {
    key: "Eb major",
    title: "My Bonnie Lies Over the Ocean",
    measures: [
      [
        { pitch: "Eb4", duration: "q" },
        { pitch: "G4", duration: "q" },
        { pitch: "Bb4", duration: "q" },
        { pitch: "Eb5", duration: "q" }
      ],
      [
        { pitch: "D5", duration: "q" },
        { pitch: "C5", duration: "q" },
        { pitch: "Bb4", duration: "q" },
        { pitch: "G4", duration: "q" }
      ]
    ]
  },  {
    key: "D major",
    title: "Soldier’s Joy",
    measures: [
      [
        { pitch: "A4", duration: "q" },
        { pitch: "B4", duration: "q" },
        { pitch: "D5", duration: "q" },
        { pitch: "B4", duration: "q" }
      ],
      [
        { pitch: "A4", duration: "q" },
        { pitch: "F#4", duration: "q" },
        { pitch: "D4", duration: "h" }
      ]
    ]
  },
  {
    key: "A Mixolydian",
    title: "Old Joe Clark",
    measures: [
      [
        { pitch: "A4", duration: "q" },
        { pitch: "C#5", duration: "q" },
        { pitch: "B4", duration: "q" },
        { pitch: "A4", duration: "q" }
      ],
      [
        { pitch: "G4", duration: "q" },
        { pitch: "F#4", duration: "q" },
        { pitch: "E4", duration: "h" }
      ]
    ]
  },
  {
    key: "E major",
    title: "Home on the Range",
    measures: [
      [
        { pitch: "E4", duration: "h" },
        { pitch: "G#4", duration: "q" },
        { pitch: "B4", duration: "q" }
      ],
      [
        { pitch: "C#5", duration: "q" },
        { pitch: "B4", duration: "q" },
        { pitch: "G#4", duration: "h" }
      ]
    ]
  },
  {
    key: "F major",
    title: "Oh! Susanna",
    measures: [
      [
        { pitch: "C5", duration: "q" },
        { pitch: "A4", duration: "q" },
        { pitch: "F4", duration: "q" },
        { pitch: "F4", duration: "q" }
      ],
      [
        { pitch: "F4", duration: "q" },
        { pitch: "G4", duration: "q" },
        { pitch: "A4", duration: "q" },
        { pitch: "Bb4", duration: "q" }
      ]
    ]
  }
];



const flatToSharp = {
  'Bb': 'A#',
  'Db': 'C#',
  'Eb': 'D#',
  'Gb': 'F#',
  'Ab': 'G#'
};


document.addEventListener('DOMContentLoaded', function () {
  const VF = Vex.Flow;
  const musicDiv = document.getElementById('music');
  const playBtn = document.getElementById('playBtn');
  const stopBtn = document.getElementById('stopBtn');
  const randomizeBtn = document.getElementById('randomizeBtn');
  const tempoInput = document.getElementById('tempo');
  let scheduledTimeouts = [];

  let instrument = null;
  let loopTimeoutId = null;
  var currentMelody = null;

  // Map note-duration symbols to beats
  const durationMap = {
    w: 4,  // whole
    h: 2,  // half
    q: 1,  // quarter
    e: 0.5, // eighth (letter)
    s: 0.25, // sixteenth (letter)
    // Also support numeric durations:
    '1': 4,   // whole
    '2': 2,   // half
    '4': 1,   // quarter
    '8': 0.5, // eighth
    '16': 0.25 // sixteenth
  };

  // Pick a random melody and render it
  function randomizeMelody() {
    // Stop scheduled notes if the user randomizes mid‐play
    clearScheduled();

    if (!melodies.length) return;
    const idx = Math.floor(Math.random() * melodies.length);
    currentMelody = melodies[idx];
    renderMelody();
  }

  randomizeMelody();

  function renderMelody() {
    // 1) Clear previous rendering
    musicDiv.innerHTML = '';

    if (!currentMelody || !currentMelody.measures.length) return;

    const VF = Vex.Flow;
    const measures = currentMelody.measures;
    const title = currentMelody.title || 'Random Melody';
    // show title
    const titleDiv = document.createElement('div');
    titleDiv.className = 'melody-title';
    titleDiv.textContent = title;
    musicDiv.appendChild(titleDiv);

    // 2) Create an SVG renderer and context
    const renderer = new VF.Renderer(musicDiv, VF.Renderer.Backends.SVG);
    // Give a generous total width—individual staves will size themselves
    renderer.resize(1000, 200);
    const context = renderer.getContext();
    context.setFont('Arial', 10, '').setBackgroundFillStyle('#fff');

    // 3) We'll place staves one after another along the x-axis
    let currentX = 10;
    const staveY = 40;

    measures.forEach((measureNotes, idx) => {
      // 4) Decide a dynamic width for this measure.
      //  For example, 60px per note head (adjust as needed):
      const widthPerNote = 60;
      const thisWidth = measureNotes.length * widthPerNote;

      // 5) Create a stave at (currentX, staveY) with computed width
      const stave = new VF.Stave(currentX, staveY, thisWidth);

      // 5a) Only the very first stave shows clef & time
      if (idx === 0) {
        stave.addClef('treble').addTimeSignature('4/4');
      }

      stave.setContext(context).draw();

      // 6) Convert JSON notes into VexFlow StaveNotes
      const vfNotes = measureNotes.map((noteObj) => {
        const raw = noteObj.pitch; // e.g. "C#4"
        const letter = raw.slice(0, raw.length - 1); // "C#"
        const oct = raw.slice(-1);           // "4"
        const key = letter.toLowerCase() + '/' + oct;  // "c#/4"

        const staveNote = new VF.StaveNote({
          clef: 'treble',
          keys: [key],
          duration: noteObj.duration, // e.g. "q", "h", etc.
        });

        if (letter.includes('#')) {
          staveNote.addAccidental(0, new VF.Accidental('#'));
        } else if (letter.includes('b')) {
          staveNote.addAccidental(0, new VF.Accidental('b'));
        }
        return staveNote;
      });

      // 7) Justify and draw notes to fill the entire measure width
      VF.Formatter.FormatAndDraw(context, stave, vfNotes);

      // 8) Advance currentX by this stave’s width (no extra gap)
      currentX += thisWidth;
    });
  }

  function clearScheduled() {
    scheduledTimeouts.forEach((id) => clearTimeout(id));
    scheduledTimeouts = [];
    if (loopTimeoutId) {
      clearTimeout(loopTimeoutId);
      loopTimeoutId = null;
    }
  }

  // Play the current melody using AudioSynth
  // play one octave below to accomodate guitar
function playMelody() {
  if (!currentMelody) return;

  clearScheduled();

  const tempo = parseInt(tempoInput.value, 10) || 90;
  const beatDurationSec = 60 / tempo;
  instrument = Synth.createInstrument('piano');

  let timeOffset = 0;

  currentMelody.measures.forEach((measureNotes) => {
    measureNotes.forEach((noteObj) => {
      const rawPitch = noteObj.pitch;
      const letterAcc = rawPitch.slice(0, rawPitch.length - 1);
      // Subtract 1 here to play one octave lower:
      const originalOctave = parseInt(rawPitch.slice(-1), 10);
      const octaveNum = originalOctave - 1;

      let noteName = letterAcc;
      if (flatToSharp[noteName]) {
        noteName = flatToSharp[noteName];
      }

      const beats = durationMap[noteObj.duration] || 1;
      const durationSec = beats * beatDurationSec;

      const timeoutId = setTimeout(() => {
        instrument.play(noteName, octaveNum, durationSec);
      }, timeOffset * 1000);

      scheduledTimeouts.push(timeoutId);
      timeOffset += durationSec;
    });
  });

  loopTimeoutId = setTimeout(() => {
    playMelody();
  }, timeOffset * 1000);
}

  // Wire up event listeners
  playBtn.addEventListener('click', playMelody);
  stopBtn.addEventListener('click', () => {clearScheduled()});
  randomizeBtn.addEventListener('click', randomizeMelody);
});

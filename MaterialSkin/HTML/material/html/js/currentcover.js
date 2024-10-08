/**
 * LMS-Material
 *
 * Copyright (c) 2018-2024 Craig Drummond <craig.p.drummond@gmail.com>
 * MIT license.
 */
'use strict';

var currentCover = undefined;
var lmsCurrentCover = Vue.component('lms-currentcover', {
    template: `<div><img crossOrigin="anonymous" id="current-cover" :src="accessUrl" style="display:none"/></div>`,
    data() {
        return {
            accessUrl: undefined
        };
    },
    mounted: function() {
        this.coverUrl = DEFAULT_COVER;
        this.fac = new FastAverageColor();
        bus.$on('playerStatus', function(playerStatus) {
            // Has cover changed?
            var coverUrl = this.coverUrl;

            if (playerStatus.playlist.count == 0) {
                this.queueIndex = undefined;
                if (undefined===this.coverFromInfo || this.coverFromInfo || undefined==this.cover) {
                    coverUrl=DEFAULT_COVER; //resolveImageUrl(DEFAULT_COVER, LMS_CURRENT_IMAGE_SIZE);
                    this.coverFromInfo = false;
                }
            } else {
                this.queueIndex = playerStatus.current["playlist index"];
                coverUrl = undefined;
                if (playerStatus.current.artwork_url) {
                    coverUrl=resolveImageUrl(playerStatus.current.artwork_url, LMS_CURRENT_IMAGE_SIZE);
                }
                if (undefined==coverUrl && undefined!=playerStatus.current.coverid) { // && !(""+playerStatus.current.coverid).startsWith("-")) {
                    coverUrl="/music/"+playerStatus.current.coverid+"/cover"+LMS_CURRENT_IMAGE_SIZE;
                }
                if (undefined==coverUrl && LMS_P_MAI) {
                    if (playerStatus.current.artist_ids) {
                        coverUrl="/imageproxy/mai/artist/" + playerStatus.current.artist_ids[0] + "/image" + LMS_CURRENT_IMAGE_SIZE;
                    } else if (playerStatus.current.artist_id) {
                        coverUrl="/imageproxy/mai/artist/" + playerStatus.current.artist_id + "/image" + LMS_CURRENT_IMAGE_SIZE;
                    }
                }
                if (undefined==coverUrl) {
                    // Use players current cover as cover image. Need to add extra (coverid, etc) params so that
                    // the URL is different between tracks...
                    coverUrl="/music/current/cover.jpg?player=" + this.$store.state.player.id;
                    if (playerStatus.current.album_id) {
                        coverUrl+="&album_id="+playerStatus.current.album_id;
                    } else {
                        if (playerStatus.current.album) {
                            coverUrl+="&album="+encodeURIComponent(playerStatus.current.album);
                        }
                        if (playerStatus.current.albumartist) {
                            coverUrl+="&artist="+encodeURIComponent(playerStatus.current.albumartist);
                        }
                        if (playerStatus.current.year && playerStatus.current.year>0) {
                            coverUrl+="&year="+playerStatus.current.year;
                        }
                    }
                    coverUrl=resolveImageUrl(coverUrl, LMS_CURRENT_IMAGE_SIZE);
                }
                this.coverFromInfo = true;
            }

            if (coverUrl!=this.coverUrl) {
                this.coverUrl = coverUrl;
                bus.$emit('currentCover', this.coverUrl, this.queueIndex);
                if (1==queryParams.nativeCover) {
                    try {
                        NativeReceiver.coverUrl(this.coverUrl);
                    } catch (e) {
                    }
                } else if (queryParams.nativeCover>0) {
                    emitNative("MATERIAL-COVER\nURL " + this.coverUrl, queryParams.nativeCover);
                }

                if (this.$store.state.color==COLOR_FROM_COVER) {
                    this.accessUrl = undefined==coverUrl || (!coverUrl.startsWith("http:") && !coverUrl.startsWith("https:"))
                        ? coverUrl
                        : "https://images1-focus-opensocial.googleusercontent.com/gadgets/proxy?container=focus&refresh=2592000&url="+encodeURIComponent(coverUrl);
                } else {
                    this.accessUrl = undefined;
                }
            }
        }.bind(this));

        bus.$on('getCurrentCover', function() {
            bus.$emit('currentCover', this.coverUrl, this.queueIndex);
        }.bind(this));

        currentCover = this;
        document.getElementById('current-cover').addEventListener('load', function() {
            currentCover.calculateColors();
        });
        bus.$on('themeChanged', function() {
            if (this.$store.state.color==COLOR_FROM_COVER && this.accessUrl!=this.coverUrl) {
                this.accessUrl = this.coverUrl;
            }
        }.bind(this));
        bus.$on('colorListLoaded', function() {
            this.colorListLoaded();
        }.bind(this));
        this.colorList = { };
        getMiscJson(this.colorList, "colors", undefined, 'colorListLoaded');
    },
    methods: {
        colorListLoaded() {
            let list = [];
            this.otherList = [];
            for (let c=0, cl=this.colorList.colors, len=cl.length; c<len; ++c) {
                if (undefined!=cl[c].acolor) {
                    list.push([hex2Rgb(cl[c].color), cl[c]]);
                } else if (undefined!=cl[c].others) {
                    this.otherList = cl[c].others;
                }
            }
            this.colorList = list;
            if (this.calculateColorsRequired) {
                this.calculateColorsRequired = false;
                this.calculateColors();
            }
        },
        calculateColors() {
            if (this.$store.state.color!=COLOR_FROM_COVER) {
                return;
            }
            if (this.colorList.length<1) {
                this.calculateColorsRequired = true;
                return;
            }
            this.fac.getColorAsync(document.getElementById('current-cover'), {mode:'precision'}).then(color => {
                let rgb = undefined;
                let orgbs = color.rgb.replace('rgb(', '').replace(')', '').split(',');
                let orgb = [parseInt(orgbs[0]), parseInt(orgbs[1]), parseInt(orgbs[2])];
                let isDefCover = DEFAULT_COVER==this.coverUrl;
                let useDefault = isDefCover;
                if (!useDefault) {
                    // If colour is too light, or too dark, then use default
                    // HSP (Highly Sensitive Poo) equation from http://alienryderflex.com/hsp.html
                    let hsp = Math.sqrt(0.299 * (orgb[0]**2) + 0.587 * (orgb[1]**2) + 0.114 * (orgb[2]**2));
                    useDefault = hsp>=235 || hsp<=50;
                    if (!useDefault) {
                        // Find the nearest colour in our palette
                        let col = 0;
                        let diff = 2000000;
                        let useOtherList = false;
                        for (let c=0, list=this.colorList, len=list.length; c<len; ++c) {
                            let d = ((orgb[0]-list[c][0][0])**2) + ((orgb[1]-list[c][0][1])**2) + ((orgb[2]-list[c][0][2])**2);
                            if (d<diff) {
                                diff = d;
                                col = c;
                            }
                        }
                        if (!store.state.coloredToolbars) {
                            for (let c=0, list=this.otherList, len=list.length; c<len; ++c) {
                                let d = ((orgb[0]-list[c][0])**2) + ((orgb[1]-list[c][1])**2) + ((orgb[2]-list[c][2])**2);
                                if (d<diff) {
                                    diff = d;
                                    col = c;
                                    useOtherList = true;
                                }
                            }
                        }
                        if (useOtherList) {
                            rgb = this.otherList[col];
                            let hexStr = rgb2Hex(rgb);
                            document.documentElement.style.setProperty('--accent-color', hexStr);
                            document.documentElement.style.setProperty('--primary-color', hexStr);
                        } else {
                            rgb = this.colorList[col][0];
                            document.documentElement.style.setProperty('--accent-color', this.colorList[col][1].acolor);
                            document.documentElement.style.setProperty('--primary-color', this.colorList[col][1].color);
                        }
                        document.documentElement.style.setProperty('--highlight-rgb', rgb[0]+","+rgb[1]+","+rgb[2]);
                    }
                }

                if (isDefCover) {
                    document.documentElement.style.setProperty('--tint-color', '#1976d2');
                } else {
                    document.documentElement.style.setProperty('--tint-color', rgb2Hex(orgb));
                }

                if (useDefault) {
                    rgb = [25,118,210];
                    document.documentElement.style.setProperty('--accent-color', '#82b1ff');
                    document.documentElement.style.setProperty('--primary-color', '#1976d2');
                    document.documentElement.style.setProperty('--highlight-rgb', '25,118,210');
                }

                emitToolbarColorsFromState(this.$store.state);
                if (1==queryParams.nativeAccent) {
                    bus.$nextTick(function () {
                        try {
                            NativeReceiver.updateAccentColor(hexColor);
                        } catch (e) {
                        }
                    });
                } else if (queryParams.nativeAccent>0) {
                    emitNative("MATERIAL-ACCENT\nVAL " + hexColor, queryParams.nativeAccent);
                }
                bus.$emit("colorChanged", rgb[0]+rgb[1]+rgb[2]);
            }).catch(e => {
            });
        }
    }
});

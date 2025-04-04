/**
 * LMS-Material
 *
 * Copyright (c) 2018-2024 Craig Drummond <craig.p.drummond@gmail.com>
 * MIT license.
 */
'use strict';

Vue.component('lms-rating-dialog', {
    template: `
<v-dialog v-model="show" v-if="show" scrollable width="350">
 <v-card>
  <v-card-title>{{title}}</v-card-title>
  <v-card-text>
   <v-layout text-xs-center row wrap>
    <v-flex xs12 class="np-text">
     <v-rating large v-model="value" :halfIncrements="maxRating>5" hover clearable></v-rating>
    </v-flex>
   </v-layout>
  </v-card-text>
  <v-card-actions v-if="queryParams.altBtnLayout">
   <v-spacer></v-spacer>
   <v-btn flat @click.native="apply()">{{i18n('Apply')}}</v-btn>
   <v-btn flat @click.native="remove()">{{i18n('Remove')}}</v-btn>
   <v-btn flat @click.native="cancel()">{{i18n('Cancel')}}</v-btn>
  </v-card-actions>
  <v-card-actions v-else>
   <v-spacer></v-spacer>
   <v-btn flat @click.native="cancel()">{{i18n('Cancel')}}</v-btn>
   <v-btn flat @click.native="remove()">{{i18n('Remove')}}</v-btn>
   <v-btn flat @click.native="apply()">{{i18n('Apply')}}</v-btn>
  </v-card-actions>
 </v-card>
</v-dialog>
`,
    props: [],
    data() {
        return {
            show: false,
            title: "",
            value: 0,
            item: undefined
        }
    },
    computed: {
        maxRating() {
            return this.$store.state.maxRating
        }
    },
    mounted() {
        bus.$on('rating.open', function(ids, current) {
            console.log(this.$store.state.maxRating)
            if (this.$store.state.player.id) {
                this.ids = ids;
                if (ids.length>1) {
                    this.title=i18n("Set rating for %1 tracks", ids.length);
                } else {
                    this.title=i18n("Set rating");
                }
                this.value = undefined==current ? 3 : (current/20.0);
                this.toSet = undefined;
                this.show = true;
            }
        }.bind(this));
        bus.$on('noPlayers', function() {
            this.show=false;
        }.bind(this));
        bus.$on('closeDialog', function(dlg) {
            if (dlg == 'rating') {
                this.show=false;
            }
        }.bind(this));
    },
    methods: {
        cancel() {
            this.show=false;
        },
        apply() {
            if (this.toSet) {
                return;
            }
            this.toSet = [];
            this.ids.forEach(i => {
                this.toSet.push(i.split(":")[1]);
            });
            this.setRating();
        },
        remove() {
            this.value = 0;
            this.apply();
        },
        setRating() {
            if (this.toSet.length==0) {
                this.toSet = undefined;
                this.show=false;
                bus.$emit('ratingsSet', this.ids, this.value);
            } else {
                lmsCommand(this.$store.state.player.id, [LMS_P_RP, "setrating", this.toSet[0], this.value]).then(({data}) => {
                    if (this.show) {
                        this.toSet.shift();
                        this.setRating();
                    }
                });
            }
        },
        i18n(str) {
            if (this.show) {
                return i18n(str);
            } else {
                return str;
            }
        }
    },
    watch: {
        'show': function(val) {
            this.$store.commit('dialogOpen', {name:'rating', shown:val});
        }
    }
})


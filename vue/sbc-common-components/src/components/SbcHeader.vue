<template>
  <header class="app-header">
    <div class="container">
      <a @click="goToHome()" class="brand">
        <picture>
          <source media="(min-width: 601px)"
            srcset="../assets/img/gov_bc_logo_horiz.png">
          <source media="(max-width: 600px)"
            srcset="../assets/img/gov_bc_logo_vert.png">
          <img class="brand__image"
            src="../assets/img/gov_bc_logo_vert.png"
            alt="Government of British Columbia Logo"
            title="Government of British Columbia">
        </picture>
        <span class="brand__title">BC Registries <span class="brand__title--wrap">& Online Services</span></span>
      </a>
      <div class="app-header__actions">

        <!-- Product Selector -->
        <sbc-product-selector v-if="showProductSelector" />

        <v-btn color="#fcba19" class="log-in-btn" v-if="!isAuthenticated" @click="login()">
          <slot name="login-button-text">
            Log in with BC Services Card
          </slot>
        </v-btn>

        <!-- Messages -->
        <v-menu bottom left fixed transition="slide-y-transition" v-if="isAuthenticated">
          <template v-slot:activator="{ on }">
            <v-btn text large class="notifications-btn mr-2 ml-2 pl-1 pr-1" v-on="on">
              <v-icon class="white--text">
                mdi-bell-outline
              </v-icon>
              <v-badge dot overlap offset-y="-6" color="error" v-if="pendingApprovalCount > 0"/>
              <!-- <v-icon small>mdi-chevron-down</v-icon> -->
            </v-btn>
          </template>
          <v-list tile dense>
            <!-- No Items -->
            <v-list-item v-if="pendingApprovalCount === 0">
              <v-list-item-title>No actions required</v-list-item-title>
            </v-list-item>

            <v-list-item two-line v-if="pendingApprovalCount > 0" @click="goToTeamMembers()">
              <v-list-item-content>
                <v-list-item-title>You have {{ pendingApprovalCount }} pending approvals</v-list-item-title>
                <v-list-item-subtitle>{{ pendingApprovalCount }} <span>{{pendingApprovalCount == '1' ? 'team member' : 'team members'}}</span> require approval to access this account</v-list-item-subtitle>
              </v-list-item-content>
            </v-list-item>
          </v-list>
        </v-menu>

        <!-- Account -->
        <v-menu bottom left fixed transition="slide-y-transition" content-class="account-menu" v-if="isAuthenticated">
          <template v-slot:activator="{ on }">
            <v-btn text large v-on="on" class="user-account-btn">
              <v-avatar tile left size="32" class="user-avatar">
                {{ username.slice(0,1) }}
              </v-avatar>
              <div class="user-info">
                <div class="user-name" data-test="user-name">{{ username }}</div>
                <div class="account-name" v-if="accountType !== 'IDIR'" data-test="account-name">{{ accountName }}</div>
              </div>
              <!--
              <v-icon small class="ml-2">mdi-chevron-down</v-icon>
              -->
            </v-btn>
          </template>
          <v-list tile dense>
            <v-list-item two-line>
              <v-list-item-avatar tile size="36" color="#3f5c94" class="user-avatar mr-4">
                {{ username.slice(0,1) }}
              </v-list-item-avatar>
              <v-list-item-content class="user-info">
                <v-list-item-title class="user-name" data-test="menu-user-name">{{ username }}</v-list-item-title>
                <v-list-item-subtitle class="account-name" v-if="accountType !== 'IDIR'" data-test="menu-account-name">{{ accountName }}</v-list-item-subtitle>
              </v-list-item-content>
            </v-list-item>
            <!-- BEGIN: Hide if authentication is IDIR -->
            <v-list-item @click="goToUserProfile()" v-if="accountType === 'BCSC'">
              <v-list-item-icon left>
                <v-icon>mdi-account-outline</v-icon>
              </v-list-item-icon>
              <v-list-item-title>Edit Profile</v-list-item-title>
            </v-list-item>
            <!-- END -->
            <v-list-item @click="logout()">
              <v-list-item-icon left>
                <v-icon>mdi-logout-variant</v-icon>
              </v-list-item-icon>
              <v-list-item-title>Log out</v-list-item-title>
            </v-list-item>
          </v-list>

          <v-divider></v-divider>

          <v-list tile dense v-if="currentAccount && accountType !== 'IDIR'">
            <v-subheader>ACCOUNT SETTINGS</v-subheader>
            <v-list-item @click="goToAccountInfo(currentAccount)">
              <v-list-item-icon left>
                <v-icon>mdi-information-outline</v-icon>
              </v-list-item-icon>
              <v-list-item-title>Account Info</v-list-item-title>
            </v-list-item>
            <v-list-item @click="goToTeamMembers()">
              <v-list-item-icon left>
                <v-icon>mdi-account-group-outline</v-icon>
              </v-list-item-icon>
              <v-list-item-title>Team Members</v-list-item-title>
            </v-list-item>
            <v-list-item
              v-if="showTransactions"
              @click="goToTransactions()">
              <v-list-item-icon left>
                <v-icon>mdi-file-document-outline</v-icon>
              </v-list-item-icon>
              <v-list-item-title>Transactions</v-list-item-title>
            </v-list-item>
          </v-list>

          <v-divider></v-divider>

          <v-list tile dense v-if="accountType !== 'IDIR' && switchableAccounts.length > 1">
            <v-subheader>SWITCH ACCOUNT</v-subheader>
            <v-list-item @click="switchAccount(settings, inAuth)" v-for="(settings, id) in switchableAccounts" :key="id">
              <v-list-item-icon left>
                <v-icon v-show="settings.id === currentAccount.id">mdi-check</v-icon>
              </v-list-item-icon>
              <v-list-item-title>{{ settings.label }}</v-list-item-title>
            </v-list-item>
          </v-list>

        </v-menu>
      </div>
    </div>
  </header>
</template>

<script lang="ts">
import { Component, Mixins, Prop } from 'vue-property-decorator'
import { initialize, LDClient } from 'launchdarkly-js-client-sdk'
import ConfigHelper from '../util/config-helper'
import { SessionStorageKeys } from '../util/constants'
import { mapState, mapActions, mapGetters } from 'vuex'
import { UserSettings } from '../models/userSettings'
import Vue from 'vue'
import NavigationMixin from '../mixins/navigation-mixin'
import { getModule } from 'vuex-module-decorators'
import AccountModule from '../store/modules/account'
import AuthModule from '../store/modules/auth'
import { KCUserProfile } from '../models/KCUserProfile'
import keycloakService from '../services/keycloak.services'
import LaunchDarklyService from '../services/launchdarkly.services'
import SbcProductSelector from './SbcProductSelector.vue'

declare module 'vuex' {
  interface Store<S> {
    isModuleRegistered(_: string[]): boolean
  }
}

@Component({
  beforeCreate () {
    this.$store.isModuleRegistered = function (aPath: string[]) {
      let m = (this as any)._modules.root
      return aPath.every((p) => {
        m = m._children[p]
        return m
      })
    }
    if (!this.$store.isModuleRegistered(['account'])) {
      this.$store.registerModule('account', AccountModule)
    }
    if (!this.$store.isModuleRegistered(['auth'])) {
      this.$store.registerModule('auth', AuthModule)
    }
    this.$options.computed = {
      ...(this.$options.computed || {}),
      ...mapState('account', ['currentAccount', 'pendingApprovalCount']),
      ...mapGetters('account', ['accountName', 'accountType', 'switchableAccounts', 'username']),
      ...mapGetters('auth', ['isAuthenticated'])
    }
    this.$options.methods = {
      ...(this.$options.methods || {}),
      ...mapActions('account', ['loadUserInfo', 'syncAccount', 'syncCurrentAccount']),
      ...mapActions('auth', ['syncWithSessionStorage'])
    }
  },
  components: {
    SbcProductSelector
  }
})
export default class SbcHeader extends Mixins(NavigationMixin) {
  private ldClient!: LDClient
  private readonly currentAccount!: UserSettings | null
  private readonly pendingApprovalCount!: number
  private readonly username!: string
  private readonly accountName!: string
  private readonly accountType!: string
  private readonly isAuthenticated!: boolean
  private readonly switchableAccounts!: UserSettings[]
  private readonly loadUserInfo!: () => KCUserProfile
  private readonly syncAccount!: () => Promise<void>
  private readonly syncCurrentAccount!: (userSettings: UserSettings) => Promise<UserSettings>
  private readonly syncWithSessionStorage!: () => void

  @Prop({ default: '' }) redirectOnLoginSuccess!: string;
  @Prop({ default: '' }) redirectOnLoginFail!: string;
  @Prop({ default: '' }) redirectOnLogout!: string;
  @Prop({ default: false }) inAuth!: boolean;
  @Prop({ default: '' }) idpHint!: string;
  @Prop({ default: false }) showProductSelector!: boolean;

  get showAccountSwitching (): boolean {
    return LaunchDarklyService.getFlag('account-switching') || false
  }

  get showTransactions (): boolean {
    return LaunchDarklyService.getFlag('transaction-history') || false
  }

  private async mounted () {
    getModule(AccountModule, this.$store)
    getModule(AuthModule, this.$store)
    this.syncWithSessionStorage()
    if (this.isAuthenticated) {
      this.loadUserInfo()
      await this.syncAccount()
    }
  }

  private goToHome () {
    if (this.inAuth) {
      this.navigateTo(ConfigHelper.getAuthContextPath(), 'home')
    } else {
      window.location.assign(`${ConfigHelper.getAuthContextPath()}home`)
    }
  }

  private goToUserProfile () {
    if (this.inAuth) {
      this.navigateTo(ConfigHelper.getAuthContextPath(), 'userprofile')
    } else {
      window.location.assign(`${ConfigHelper.getAuthContextPath()}userprofile`)
    }
  }

  private async goToAccountInfo (settings: UserSettings) {
    if (!this.currentAccount || !settings) {
      return
    }
    await this.syncCurrentAccount(settings)
    if (this.inAuth) {
      this.navigateTo(ConfigHelper.getAuthContextPath(), `account/${this.currentAccount.id}/settings/account-info`)
    } else {
      window.location.assign(`${ConfigHelper.getAuthContextPath()}account/${this.currentAccount.id}/settings/account-info`)
    }
  }

  private goToTeamMembers () {
    if (!this.currentAccount) {
      return
    }
    if (this.inAuth) {
      this.navigateTo(ConfigHelper.getAuthContextPath(), `account/${this.currentAccount.id}/settings/team-members`)
    } else {
      window.location.assign(`${ConfigHelper.getAuthContextPath()}account/${this.currentAccount.id}/settings/team-members`)
    }
  }

  private goToTransactions () {
    if (!this.currentAccount) {
      return
    }
    if (this.inAuth) {
      this.navigateTo(ConfigHelper.getAuthContextPath(), `account/${this.currentAccount.id}/settings/transactions`)
    } else {
      window.location.assign(`${ConfigHelper.getAuthContextPath()}account/${this.currentAccount.id}/settings/transactions`)
    }
  }

  private async switchAccount (settings: UserSettings, inAuth?: boolean) {
    this.$emit('account-switch-started')
    if (this.$route.params.orgId) {
      // If route includes a URL param for account, we need to refresh with the new account id
      this.$router.push({ name: this.$route.name, params: { orgId: settings.id } })
    }
    await this.syncCurrentAccount(settings)
    this.$emit('account-switch-completed')

    if (!inAuth) {
      window.location.assign(`${ConfigHelper.getAuthContextPath()}home`)
    }
  }

  logout () {
    if (this.redirectOnLogout) {
      const url = encodeURIComponent(this.redirectOnLogout)
      window.location.assign(`${this.getContextPath()}signout/${url}`)
    } else {
      window.location.assign(`${this.getContextPath()}signout`)
    }
  }

  login () {
    if (this.redirectOnLoginSuccess) {
      let url = encodeURIComponent(this.redirectOnLoginSuccess)
      url += this.redirectOnLoginFail ? `/${encodeURIComponent(this.redirectOnLoginFail)}` : ''
      window.location.assign(`${this.getContextPath()}signin/${this.idpHint}/${url}`)
    } else {
      window.location.assign(`${this.getContextPath()}signin/${this.idpHint}`)
    }
  }

  private getContextPath (): string {
    let baseUrl = (this.$router && (this.$router as any)['history'] && (this.$router as any)['history'].base) || ''
    baseUrl += (baseUrl.length && baseUrl[baseUrl.length - 1] !== '/') ? '/' : ''
    return baseUrl
  }
}
</script>

<style lang="scss" scoped>
@import "../assets/scss/theme.scss";

$app-header-font-color: #ffffff;

.app-header {
  height: 70px;
  color: $app-header-font-color;
  border-bottom: 2px solid $BCgovGold5;
  background-color: #003366;

  .container {
    display: flex;
    align-items: center;
    height: 100%;
    padding-top: 0;
    padding-bottom: 0;
  }
}

.app-header__actions {
  display: flex;
  align-items: center;
  margin-left: auto;

  .v-btn {
    margin-right: 0;
  }
}

.brand {
  display: flex;
  align-items: center;
  padding-right: 1rem;
  text-decoration: none;
  color: inherit;
}

.brand__image {
  display: block;
  margin-right: 1.25rem;
  max-height: 70px;
}

.brand__title {
  letter-spacing: -0.03rem;
  font-size: 1.125rem;
  font-weight: 700;
  color: inherit;
}

@media (max-width: 900px) {
  .brand__image {
    margin-right: 0.75rem;
    margin-left: -0.15rem;
  }

  .brand__title {
    font-size: 1rem;
    line-height: 1.25rem;
  }

  .brand__title--wrap {
    display: block;
  }
}

.v-btn.user-account-btn {
  padding-right: 0.5rem !important;
  padding-left: 0.5rem !important;
  text-align: left;
  color: $app-header-font-color;
  letter-spacing: 0.02rem;
  font-size: 0.8rem;

  .user-avatar {
    margin-right: 0.75rem;
  }

  .user-name {
    line-height: 1.125rem;
    font-size: 0.75rem;
  }

  .account-name {
    margin-bottom: 0.01rem;
    font-size: 0.7rem;
    opacity: 0.75;
  }
}

.v-btn.notifications-btn {
  min-width: 3.142rem !important;
  color: $app-header-font-color;

  .v-badge {
    margin-right: 0.25rem;
  }
}

@media (max-width: 960px) {
  .v-btn.user-account-btn {
    min-width: auto !important;
    font-size: 0.8rem;

    .user-avatar {
      margin-right: 0;
    }

    .user-info {
      display: none;
    }
  }
}

// Account Menu
.account-menu {
  background: #ffffff;
}

.account-menu__info {
  font-size: 0.875rem;
}

.v-list {
  border-radius: 0;

  .v-list-item__title,
  .v-list-item__subtitle {
    line-height: normal !important;
  }
}

.v-list .v-list-item__title.user-name,
.user-name {
  font-size: 0.875rem;
  font-weight: 400;
}

.v-list .v-list-item__subtitle.account-name,
.account-name {
  font-size: 0.75rem;
}

.user-avatar {
  color: $app-header-font-color;
  border-radius: 0.15rem;
  background-color: $BCgovBlue3;
  font-size: 1.1875rem;
  font-weight: 400;
}

.log-in-btn {
  color: $BCgovBlue5;
  background-color: $BCgovGold4;
  font-weight: 700;
}

.v-list--dense .v-subheader {
  padding-right: 1rem;
  padding-left: 1rem;
}

.v-subheader {
  color: $gray9 !important;
  font-size: 0.875rem;
  font-weight: 700;
}
</style>

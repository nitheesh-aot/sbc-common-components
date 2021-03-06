import { Action, Module, Mutation, VuexModule } from 'vuex-module-decorators'
import AccountService from '../../services/account.services'
import { Member } from '../../models/member'
import { UserSettings } from '../../models/userSettings'
import { KCUserProfile } from '../../models/KCUserProfile'
import KeyCloakService from '../../services/keycloak.services'
import ConfigHelper from '../../util/config-helper'
import { SessionStorageKeys } from '../../util/constants'

@Module({
  name: 'account',
  namespaced: true
})
export default class AccountModule extends VuexModule {
  userSettings: UserSettings[] = []
  currentAccount: UserSettings | null = null
  currentAccountMembership: Member | null = null
  pendingApprovalCount = 0
  currentUser: KCUserProfile | null = null

  get accountName () {
    return this.currentAccount && this.currentAccount.label
  }

  get accountType (): string {
    return ConfigHelper.getFromSession(SessionStorageKeys.UserAccountType) || 'BCSC'
  }

  get switchableAccounts () {
    return this.userSettings && this.userSettings.filter(setting => setting.type === 'ACCOUNT')
  }

  get username (): string {
    return `${this.currentUser?.firstName || '-'} ${this.currentUser?.lastName || ''}`
  }

  @Mutation
  public setCurrentUser (currentUser: KCUserProfile) {
    this.currentUser = currentUser
  }

  @Mutation
  public setUserSettings (userSetting: UserSettings[]): void {
    this.userSettings = userSetting
  }

  @Mutation
  public setCurrentAccount (userSetting: UserSettings): void {
    ConfigHelper.addToSession(SessionStorageKeys.CurrentAccount, JSON.stringify(userSetting))
    this.currentAccount = userSetting
  }

  @Mutation
  public setPendingApprovalCount (count: number): void {
    this.pendingApprovalCount = count
  }

  @Mutation
  public setCurrentAccountMembership (membership: Member): void {
    this.currentAccountMembership = membership
  }

  @Action({ rawError: true, commit: 'setCurrentUser' })
  public loadUserInfo () {
    // Load User Info
    return KeyCloakService.getUserInfo()
  }

  @Action({ rawError: true, commit: 'setUserSettings' })
  public async syncUserSettings (currentAccountId: string): Promise<UserSettings[]> {
    const response = await AccountService.getUserSettings()
    if (response && response.data) {
      const orgs = response.data.filter(userSettings => (userSettings.type === 'ACCOUNT'))
      this.context.commit('setCurrentAccount', currentAccountId ? orgs.find(org => String(org.id) === currentAccountId) : orgs[0])
      if (this.currentUser?.loginSource === 'BCSC') {
        await this.context.dispatch('fetchPendingApprovalCount')
      }
      return orgs
    }
    return []
  }

  @Action({ rawError: true, commit: 'setPendingApprovalCount' })
  public async fetchPendingApprovalCount (): Promise<number> {
    if (this.context.rootState.account && this.context.rootState.account.currentAccount && this.context.rootState.account.currentAccount.id) {
      const response = await AccountService.getPendingMemberCount(this.context.rootState.account.currentAccount.id)
      return (response && response.data && response.data.count) || 0
    } else {
      return 0
    }
  }

  @Action({ rawError: true, commit: 'setCurrentAccount' })
  public async syncCurrentAccount (userSetting: UserSettings): Promise<UserSettings> {
    return userSetting
  }

  @Action({ rawError: true })
  public async syncAccount () {
    function getLastAccountId (): string {
      let pathList = window.location.pathname.split('/')
      let indexOfAccount = pathList.indexOf('account')
      let nextValAfterAccount = indexOfAccount > 0 ? pathList[indexOfAccount + 1] : ''
      let orgIdFromUrl = isNaN(+nextValAfterAccount) ? '' : nextValAfterAccount
      const storageAccountId = JSON.parse(ConfigHelper.getFromSession(SessionStorageKeys.CurrentAccount) || '{}').id
      return orgIdFromUrl || String(storageAccountId || '') || ''
    }

    switch (this.accountType) {
      case 'IDIR':
        break
      case 'BCSC':
      case 'BCROS':
      default:
        const lastUsedAccount = getLastAccountId()
        if (ConfigHelper.getFromSession(SessionStorageKeys.UserKcId)) {
          await this.syncUserSettings(lastUsedAccount)
          ConfigHelper.addToSession(SessionStorageKeys.CurrentAccount, JSON.stringify(this.currentAccount || ''))
        }
    }
  }
}

import { Component, OnDestroy, OnInit } from '@angular/core';

import { EventSystem, Network } from '@udonarium/core/system';
import { PeerContext } from '@udonarium/core/system/network/peer-context';
import { GameSystemSetting } from '@udonarium/game-system-setting';
import { PeerCursor } from '@udonarium/peer-cursor';

import { ModalService } from 'service/modal.service';
import { PanelService } from 'service/panel.service';

@Component({
  selector: 'room-setting',
  templateUrl: './room-setting.component.html',
  styleUrls: ['./room-setting.component.css']
})
export class RoomSettingComponent implements OnInit, OnDestroy {
  peers: PeerContext[] = [];
  isReloading: boolean = false;

  roomName: string = 'ふつうの部屋';
  password: string = '';
  isPrivate: boolean = false;
  gameType: string = GameSystemSetting.instance.gameType;

  get peerId(): string { return Network.peerId; }
  get isConnected(): boolean { return 0 < Network.peerIds.length; }
  validateLength: boolean = false;

  constructor(
    private panelService: PanelService,
    private modalService: ModalService
  ) { }

  ngOnInit() {
    Promise.resolve().then(() => this.modalService.title = this.panelService.title = 'ルーム作成');
    EventSystem.register(this);
    this.calcPeerId(this.roomName, this.password);
  }

  ngOnDestroy() {
    EventSystem.unregister(this);
  }

  calcPeerId(roomName: string, password: string) {
    let userId = Network.peer.userId;
    let peer = PeerContext.create(userId, PeerContext.generateId('***'), roomName, password);
    this.validateLength = peer.peerId.length < 64 ? true : false;
  }

  createRoom() {
    // ルームがネットワーク上に現れる前に確定させる
    GameSystemSetting.instance.gameType = this.gameType;

    let userId = Network.peer.userId;
    Network.open(userId, PeerContext.generateId('***'), this.roomName, this.password);
    PeerCursor.myCursor.peerId = Network.peerId;

    this.modalService.resolve(true);
  }
}
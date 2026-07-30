import { animate, keyframes, style, transition, trigger } from '@angular/animations';
import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';

import { ChatMessage } from '@udonarium/chat-message';
import { ImageFile } from '@udonarium/core/file-storage/image-file';
import { StringUtil } from '@udonarium/core/system/util/string-util';
import { ChatMessageService } from 'service/chat-message.service';

@Component({
  selector: 'chat-message',
  templateUrl: './chat-message.component.html',
  styleUrls: ['./chat-message.component.css'],
  animations: [
    trigger('flyInOut', [
      transition('* => active', [
        animate('200ms ease-out', keyframes([
          style({ transform: 'translateX(100px)', opacity: '0', offset: 0 }),
          style({ transform: 'translateX(0)', opacity: '1', offset: 1.0 })
        ]))
      ]),
      transition('void => *', [
        animate('200ms ease-out', keyframes([
          style({ opacity: '0', offset: 0 }),
          style({ opacity: '1', offset: 1.0 })
        ]))
      ])
    ])
  ],
  changeDetection: ChangeDetectionStrategy.Default
})

export class ChatMessageComponent implements OnInit {
  @Input() chatMessage: ChatMessage;
  imageFile: ImageFile = ImageFile.Empty;
  animeState: string = 'inactive';

  private _isEditing: boolean = false;
  get isEditing(): boolean { return this._isEditing; }
  editingText: string = '';

  /** ルビ記法を <ruby> に変換した表示用HTML。safeパイプは通さず、Angularのサニタイザに検証させる。 */
  get rubiedText(): string {
    return StringUtil.rubyToHtml(StringUtil.escapeHtml(this.chatMessage.text));
  }

  constructor(
    private chatMessageService: ChatMessageService
  ) { }

  ngOnInit() {
    let file: ImageFile = this.chatMessage.image;
    if (file) this.imageFile = file;
    let time = this.chatMessageService.getTime();
    if (time - 10 * 1000 < this.chatMessage.timestamp) this.animeState = 'active';
  }

  discloseMessage() {
    this.chatMessage.tag = this.chatMessage.tag.replace('secret', '');
  }

  startEdit() {
    this._isEditing = true;
    this.editingText = this.chatMessage.text;
  }

  saveEdit() {
    this._isEditing = false;
    if (this.chatMessage.text !== this.editingText) {
      this.chatMessage.isEdited = true;
      this.chatMessage.text = this.editingText;
    }
    this.editingText = '';
  }

  cancelEdit() {
    this._isEditing = false;
    this.editingText = '';
  }
}

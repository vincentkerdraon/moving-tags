import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ErrorService {
  private errorSubject = new BehaviorSubject<string | null>(null);
  readonly error$: Observable<string | null> = this.errorSubject.asObservable();

  showError(message: string) {
    this.errorSubject.next(message);
  }

  clearError() {
    this.errorSubject.next(null);
  }
}

import { Component, type ReactNode } from "react";

interface AppErrorBoundaryProps {
  children: ReactNode;
  onUndo: () => void;
  onRecover: () => void;
  version?: string;
  commands?: () => readonly string[];
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, { error: Error | null; copied: boolean }> {
  state = { error: null as Error | null, copied: false };

  static getDerivedStateFromError(error: Error) {
    return { error, copied: false };
  }

  async copyError() {
    const { error } = this.state;
    if (!error) return;
    const details = [
      `TabScore ${this.props.version ?? "0.0.0"}`,
      error.stack ?? error.message,
      ...(this.props.commands?.().slice(-20) ?? [])
    ];
    try {
      await navigator.clipboard.writeText(details.join("\n"));
      this.setState({ copied: true });
    } catch {
      this.setState({ copied: false });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <section role="alert" className="toolColumn">
        <h1>악보 화면을 그리는 중 문제가 발생했습니다.</h1>
        <p>마지막 변경을 취소하거나 자동 저장본을 열 수 있습니다.</p>
        <div className="toolButtonRow">
          <button type="button" onClick={() => {
            this.props.onUndo();
            this.setState({ error: null });
          }}>마지막 변경 취소하고 계속</button>
          <button type="button" onClick={this.props.onRecover}>자동 저장본에서 복구</button>
          <button type="button" onClick={() => { void this.copyError(); }}>
            {this.state.copied ? "오류 정보 복사됨" : "오류 정보 복사"}
          </button>
          <button type="button" onClick={() => window.location.reload()}>새로 고침</button>
        </div>
      </section>
    );
  }
}

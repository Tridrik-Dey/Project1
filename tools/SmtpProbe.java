import java.net.*;
public class SmtpProbe {
  public static void main(String[] args) throws Exception {
    String host = "smtp.gmail.com";
    System.out.println("Resolving: " + host);
    InetAddress[] addrs = InetAddress.getAllByName(host);
    for (InetAddress a : addrs) {
      System.out.println(" - " + a.getHostAddress());
    }
    try (Socket s = new Socket()) {
      s.connect(new InetSocketAddress(host, 587), 5000);
      System.out.println("TCP587 connect OK: " + s.isConnected());
    }
  }
}
